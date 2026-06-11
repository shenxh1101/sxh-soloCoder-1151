import { create } from 'zustand';
import type { TelescopeState, WeatherType, SignalMode, StarData, RecordedData, PointingInfo, ObservationTask, TrackingStatus } from '@/types';
import { WAVEFORM_SAMPLE_COUNT, SPECTRUM_BIN_COUNT, SPECTRUM_HISTORY_LENGTH, TELESCOPE_CONFIG } from '@/data/config';
import { altAzToFeedPosition, clampAltitude, normalizeAzimuth, angularDistanceDeg, lerpAngle, easeInOutCubic } from '@/utils/coordinates';
import { equatorialToHorizontal, horizontalToEquatorial, EARTH_ROTATION_RATE, angularDistance } from '@/utils/astronomy';
import { generateWaveform, computeFFT, calculateObservationQuality, findPeakFrequency, WEATHER_VISIBILITY } from '@/utils/signal';
import { exportToCSV, exportSpectrumToCSV } from '@/utils/csv';
import { ALL_STARS } from '@/data/stars';

const initialAzimuth = 180;
const initialAltitude = 45;
const initialFeedPos = altAzToFeedPosition(initialAzimuth, initialAltitude);

const initialSpectrumHistory: number[][] = [];
for (let i = 0; i < SPECTRUM_HISTORY_LENGTH; i++) {
  initialSpectrumHistory.push(new Array(SPECTRUM_BIN_COUNT).fill(0));
}

interface MotionState {
  startAz: number;
  startAlt: number;
  targetAz: number;
  targetAlt: number;
  progress: number;
  duration: number;
}

interface DriftState {
  fixedAz: number;
  fixedAlt: number;
  startTime: number;
}

let motionState: MotionState | null = null;
let driftState: DriftState | null = null;
let lastUpdateTime = performance.now();
let waveformTimestamp = 0;
let taskQueueRunning = false;
let accumulatedSNR = 0;
let accumulatedSignalStrength = 0;
let peakFrequency = 0;
let taskDataPoints = 0;

function getCurrentPointingInfo(
  targetRA: number,
  targetDec: number,
  currentAz: number,
  currentAlt: number
): PointingInfo {
  const { azimuth: targetAz, altitude: targetAlt } = equatorialToHorizontal(targetRA, targetDec);
  
  const isObservable = targetAlt >= TELESCOPE_CONFIG.minAltitude && targetAlt <= TELESCOPE_CONFIG.maxAltitude;
  
  const pointingError = angularDistanceDeg(currentAz, currentAlt, targetAz, targetAlt);
  const beamDistance = pointingError;
  const inBeam = pointingError <= TELESCOPE_CONFIG.beamWidth;
  
  let reason: string | undefined;
  if (!isObservable) {
    if (targetAlt < TELESCOPE_CONFIG.minAltitude) {
      reason = `目标高度过低 (${targetAlt.toFixed(1)}° < ${TELESCOPE_CONFIG.minAltitude}°)`;
    } else if (targetAlt > TELESCOPE_CONFIG.maxAltitude) {
      reason = `目标高度过高 (${targetAlt.toFixed(1)}° > ${TELESCOPE_CONFIG.maxAltitude}°)`;
    }
  }
  
  return {
    isObservable,
    reason,
    pointingError,
    inBeam,
    beamDistance,
  };
}

export const useTelescopeStore = create<TelescopeState>((set, get) => ({
  azimuth: initialAzimuth,
  altitude: initialAltitude,
  targetRA: 12,
  targetDec: 0,
  selectedStarId: null,
  feedPosition: initialFeedPos,
  trackingStatus: 'idle',
  pointingInfo: {
    isObservable: true,
    pointingError: 0,
    inBeam: true,
    beamDistance: 0,
  },
  
  frequency: 1420,
  gain: 20,
  signalMode: 'sine',
  
  waveformData: new Array(WAVEFORM_SAMPLE_COUNT).fill(0),
  spectrumHistory: initialSpectrumHistory,
  isRecording: false,
  recordedData: [],
  
  weather: 'clear',
  observationQuality: 95,
  
  driftScanMode: false,
  driftScanStartTime: null,
  driftScanRate: EARTH_ROTATION_RATE,
  
  currentSignalStrength: 0,
  currentSNR: 0,
  pointingError: 0,
  noiseFloor: 0.1,
  
  waterfallPaused: false,
  waterfallStartTime: Date.now(),
  
  observationTasks: [],
  currentTaskIndex: -1,
  taskAutoRecord: true,
  
  setPointing: (az: number, alt: number) => {
    const targetAz = normalizeAzimuth(az);
    const targetAlt = clampAltitude(alt);
    
    const state = get();
    const currentAz = state.azimuth;
    const currentAlt = state.altitude;
    
    const distance = angularDistanceDeg(currentAz, currentAlt, targetAz, targetAlt);
    const duration = Math.max(0.5, distance / TELESCOPE_CONFIG.maxSpeed);
    
    motionState = {
      startAz: currentAz,
      startAlt: currentAlt,
      targetAz,
      targetAlt,
      progress: 0,
      duration,
    };
    
    const { ra, dec } = horizontalToEquatorial(targetAz, targetAlt);
    
    set({
      trackingStatus: 'slewing',
      targetRA: ra,
      targetDec: dec,
      selectedStarId: null,
      driftScanMode: false,
    });
    
    driftState = null;
  },
  
  setTargetByRADec: async (ra: number, dec: number): Promise<{ success: boolean; message?: string }> => {
    const { azimuth, altitude } = equatorialToHorizontal(ra, dec);
    
    const isObservable = altitude >= TELESCOPE_CONFIG.minAltitude && altitude <= TELESCOPE_CONFIG.maxAltitude;
    
    if (!isObservable) {
      const info = getCurrentPointingInfo(ra, dec, get().azimuth, get().altitude);
      set({
        targetRA: ra,
        targetDec: dec,
        selectedStarId: null,
        trackingStatus: 'unobservable',
        pointingInfo: info,
        driftScanMode: false,
      });
      return { success: false, message: info.reason || '目标不可观测' };
    }
    
    const state = get();
    const distance = angularDistanceDeg(state.azimuth, state.altitude, azimuth, altitude);
    const duration = Math.max(0.5, distance / TELESCOPE_CONFIG.maxSpeed);
    
    motionState = {
      startAz: state.azimuth,
      startAlt: state.altitude,
      targetAz: normalizeAzimuth(azimuth),
      targetAlt: clampAltitude(altitude),
      progress: 0,
      duration,
    };
    
    set({
      trackingStatus: 'slewing',
      targetRA: ra,
      targetDec: dec,
      selectedStarId: null,
      driftScanMode: false,
    });
    
    driftState = null;
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const currentState = get();
        if (currentState.trackingStatus === 'tracking' || currentState.trackingStatus === 'unobservable') {
          clearInterval(checkInterval);
          if (currentState.trackingStatus === 'tracking') {
            resolve({ success: true, message: '目标已捕获' });
          } else {
            resolve({ success: false, message: currentState.pointingInfo.reason || '指向失败' });
          }
        }
      }, 100);
    });
  },
  
  setTargetByStar: async (star: StarData): Promise<{ success: boolean; message?: string }> => {
    const { azimuth, altitude } = equatorialToHorizontal(star.ra, star.dec);
    
    const isObservable = altitude >= TELESCOPE_CONFIG.minAltitude && altitude <= TELESCOPE_CONFIG.maxAltitude;
    
    if (!isObservable) {
      const info = getCurrentPointingInfo(star.ra, star.dec, get().azimuth, get().altitude);
      set({
        targetRA: star.ra,
        targetDec: star.dec,
        selectedStarId: star.id,
        trackingStatus: 'unobservable',
        pointingInfo: info,
        signalMode: star.isPulsar ? 'pulse' : get().signalMode,
        driftScanMode: false,
      });
      return { success: false, message: info.reason || '目标不可观测' };
    }
    
    const state = get();
    const distance = angularDistanceDeg(state.azimuth, state.altitude, azimuth, altitude);
    const duration = Math.max(0.5, distance / TELESCOPE_CONFIG.maxSpeed);
    
    motionState = {
      startAz: state.azimuth,
      startAlt: state.altitude,
      targetAz: normalizeAzimuth(azimuth),
      targetAlt: clampAltitude(altitude),
      progress: 0,
      duration,
    };
    
    set({
      trackingStatus: 'slewing',
      targetRA: star.ra,
      targetDec: star.dec,
      selectedStarId: star.id,
      signalMode: star.isPulsar ? 'pulse' : state.signalMode,
      driftScanMode: false,
    });
    
    driftState = null;
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const currentState = get();
        if (currentState.trackingStatus === 'tracking' || currentState.trackingStatus === 'unobservable') {
          clearInterval(checkInterval);
          if (currentState.trackingStatus === 'tracking') {
            resolve({ success: true, message: `已指向 ${star.name}` });
          } else {
            resolve({ success: false, message: currentState.pointingInfo.reason || '指向失败' });
          }
        }
      }, 100);
    });
  },
  
  setSignalParams: (freq: number, gain: number) => {
    set({
      frequency: Math.max(100, Math.min(3000, freq)),
      gain: Math.max(0, Math.min(60, gain)),
    });
  },
  
  setSignalMode: (mode: SignalMode) => {
    set({ signalMode: mode });
  },
  
  toggleRecording: () => {
    const state = get();
    if (!state.isRecording) {
      accumulatedSNR = 0;
      accumulatedSignalStrength = 0;
      peakFrequency = 0;
      taskDataPoints = 0;
      set({
        isRecording: true,
        recordedData: [],
      });
    } else {
      set({ isRecording: false });
    }
  },
  
  setWeather: (weather: WeatherType) => {
    set({ weather });
  },
  
  toggleDriftScan: () => {
    const state = get();
    
    if (!state.driftScanMode) {
      driftState = {
        fixedAz: state.azimuth,
        fixedAlt: state.altitude,
        startTime: performance.now(),
      };
      
      set({
        driftScanMode: true,
        driftScanStartTime: performance.now(),
        trackingStatus: 'drifting',
      });
      
      if (motionState) {
        motionState = null;
      }
    } else {
      driftState = null;
      set({
        driftScanMode: false,
        driftScanStartTime: null,
        trackingStatus: 'idle',
      });
    }
  },
  
  updateTracking: (deltaTime: number) => {
    const state = get();
    
    if (state.driftScanMode && driftState) {
      const { azimuth: currentTargetAz, altitude: currentTargetAlt } = equatorialToHorizontal(
        state.targetRA,
        state.targetDec
      );
      
      const pointingInfo = getCurrentPointingInfo(
        state.targetRA,
        state.targetDec,
        driftState.fixedAz,
        driftState.fixedAlt
      );
      
      let trackingStatus: TrackingStatus = 'drifting';
      if (!pointingInfo.isObservable) {
        trackingStatus = 'unobservable';
      } else if (pointingInfo.inBeam) {
        trackingStatus = 'drifting';
      }
      
      const newFeedPos = altAzToFeedPosition(driftState.fixedAz, driftState.fixedAlt);
      
      set({
        feedPosition: newFeedPos,
        pointingInfo,
        trackingStatus,
      });
      return;
    }
    
    if (motionState) {
      motionState.progress += deltaTime / motionState.duration;
      
      if (motionState.progress >= 1) {
        const finalAz = motionState.targetAz;
        const finalAlt = motionState.targetAlt;
        const newFeedPos = altAzToFeedPosition(finalAz, finalAlt);
        
        const pointingInfo = getCurrentPointingInfo(
          state.targetRA,
          state.targetDec,
          finalAz,
          finalAlt
        );
        
        motionState = null;
        
        let newStatus: TrackingStatus = 'tracking';
        if (!pointingInfo.isObservable) {
          newStatus = 'unobservable';
        } else if (!pointingInfo.inBeam) {
          newStatus = 'acquiring';
        }
        
        set({
          azimuth: finalAz,
          altitude: finalAlt,
          feedPosition: newFeedPos,
          trackingStatus: newStatus,
          pointingInfo,
        });
      } else {
        const t = easeInOutCubic(motionState.progress);
        const currentAz = lerpAngle(motionState.startAz, motionState.targetAz, t);
        const currentAlt = motionState.startAlt + (motionState.targetAlt - motionState.startAlt) * t;
        const newFeedPos = altAzToFeedPosition(currentAz, currentAlt);
        
        const pointingInfo = getCurrentPointingInfo(
          state.targetRA,
          state.targetDec,
          currentAz,
          currentAlt
        );
        
        set({
          azimuth: currentAz,
          altitude: currentAlt,
          feedPosition: newFeedPos,
          pointingInfo,
        });
      }
    } else if (state.selectedStarId && !state.driftScanMode) {
      const star = ALL_STARS.find(s => s.id === state.selectedStarId);
      if (star) {
        const { azimuth, altitude } = equatorialToHorizontal(star.ra, star.dec);
        const targetAz = normalizeAzimuth(azimuth);
        const targetAlt = clampAltitude(altitude);
        
        const currentAz = state.azimuth;
        const currentAlt = state.altitude;
        const distance = angularDistanceDeg(currentAz, currentAlt, targetAz, targetAlt);
        
        const pointingInfo = getCurrentPointingInfo(
          star.ra,
          star.dec,
          currentAz,
          currentAlt
        );
        
        let newStatus: TrackingStatus = state.trackingStatus;
        if (!pointingInfo.isObservable) {
          newStatus = 'unobservable';
        } else if (pointingInfo.inBeam && distance < 0.01) {
          newStatus = 'tracking';
        } else if (distance > 0.01) {
          newStatus = 'acquiring';
        }
        
        if (distance > 0.01 && pointingInfo.isObservable) {
          const maxStep = TELESCOPE_CONFIG.maxSpeed * deltaTime * 0.1;
          const step = Math.min(maxStep, distance);
          const t = distance > 0 ? step / distance : 0;
          
          const newAz = lerpAngle(currentAz, targetAz, t);
          const newAlt = currentAlt + (targetAlt - currentAlt) * t;
          const newFeedPos = altAzToFeedPosition(newAz, newAlt);
          
          set({
            azimuth: newAz,
            altitude: newAlt,
            feedPosition: newFeedPos,
            pointingInfo,
            trackingStatus: newStatus,
          });
        } else {
          set({
            pointingInfo,
            trackingStatus: newStatus,
          });
        }
      }
    } else {
      const pointingInfo = getCurrentPointingInfo(
        state.targetRA,
        state.targetDec,
        state.azimuth,
        state.altitude
      );
      
      let newStatus: TrackingStatus = state.trackingStatus;
      if (!pointingInfo.isObservable) {
        newStatus = 'unobservable';
      } else if (state.trackingStatus === 'idle' || state.trackingStatus === 'slewing') {
        newStatus = state.trackingStatus;
      } else if (pointingInfo.inBeam) {
        newStatus = 'tracking';
      } else {
        newStatus = 'acquiring';
      }
      
      set({
        pointingInfo,
        trackingStatus: newStatus,
      });
    }
  },
  
  updateSignalData: () => {
    const state = get();
    const now = performance.now();
    const delta = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;
    
    get().updateTracking(delta);
    
    waveformTimestamp += delta;
    
    const isPulsarTarget = state.selectedStarId 
      ? ALL_STARS.find(s => s.id === state.selectedStarId)?.isPulsar || false
      : false;
    
    const { waveform, signalStrength, snr, noiseFloor: computedNoiseFloor } = generateWaveform(
      WAVEFORM_SAMPLE_COUNT,
      state.frequency / 1000,
      state.gain,
      state.signalMode,
      state.weather,
      state.pointingInfo.pointingError,
      waveformTimestamp,
      isPulsarTarget,
      state.pointingInfo.beamDistance,
      state.pointingInfo.inBeam && state.pointingInfo.isObservable
    );
    
    let newHistory = state.spectrumHistory;
    if (!state.waterfallPaused) {
      const spectrum = computeFFT(waveform);
      const resampledSpectrum: number[] = [];
      const step = spectrum.length / SPECTRUM_BIN_COUNT;
      for (let i = 0; i < SPECTRUM_BIN_COUNT; i++) {
        const idx = Math.floor(i * step);
        resampledSpectrum.push(spectrum[idx] || 0);
      }
      newHistory = [resampledSpectrum, ...state.spectrumHistory.slice(0, -1)];
    }
    
    const quality = calculateObservationQuality(
      state.weather,
      state.pointingInfo.pointingError,
      state.gain - 30,
      state.pointingInfo.inBeam,
      state.pointingInfo.isObservable
    );
    
    let newRecordedData = state.recordedData;
    if (state.isRecording) {
      const record: RecordedData = {
        timestamp: Date.now(),
        ra: state.targetRA,
        dec: state.targetDec,
        azimuth: state.azimuth,
        altitude: state.altitude,
        frequency: state.frequency,
        gain: state.gain,
        signalStrength,
        snr,
        quality,
        weather: state.weather,
        pointingError: state.pointingInfo.pointingError,
        targetInBeam: state.pointingInfo.inBeam && state.pointingInfo.isObservable,
      };
      newRecordedData = [...state.recordedData, record].slice(-1000);
      
      accumulatedSNR += snr;
      accumulatedSignalStrength += signalStrength;
      taskDataPoints++;
      
      const freqMin = state.frequency - 5;
      const freqMax = state.frequency + 5;
      const latestSpectrum = newHistory[0];
      const peak = findPeakFrequency(latestSpectrum, freqMin, freqMax);
      peakFrequency = peak.frequency;
    }
    
    if (taskQueueRunning && state.currentTaskIndex >= 0) {
      const currentTask = state.observationTasks[state.currentTaskIndex];
      if (currentTask && currentTask.status === 'running' && currentTask.startTime) {
        const elapsed = (now - currentTask.startTime) / 1000;
        const progress = Math.min(100, (elapsed / currentTask.duration) * 100);
        
        if (progress >= 100) {
          get()._completeCurrentTask();
        } else {
          set({
            observationTasks: state.observationTasks.map((t, i) =>
              i === state.currentTaskIndex ? { ...t, progress } : t
            ),
          });
        }
      }
    }
    
    set({
      waveformData: waveform,
      spectrumHistory: newHistory,
      currentSignalStrength: signalStrength,
      currentSNR: snr,
      noiseFloor: computedNoiseFloor,
      observationQuality: quality,
      recordedData: newRecordedData,
      pointingError: state.pointingInfo.pointingError,
    });
  },
  
  exportCSV: () => {
    const state = get();
    exportToCSV(state.recordedData);
  },
  
  resetView: () => {
    driftState = null;
    motionState = {
      startAz: get().azimuth,
      startAlt: get().altitude,
      targetAz: initialAzimuth,
      targetAlt: initialAltitude,
      progress: 0,
      duration: 2,
    };
    
    taskQueueRunning = false;
    
    set({
      trackingStatus: 'slewing',
      targetRA: 12,
      targetDec: 0,
      selectedStarId: null,
      driftScanMode: false,
      driftScanStartTime: null,
      currentTaskIndex: -1,
    });
  },
  
  toggleWaterfallPause: () => {
    const state = get();
    set({ waterfallPaused: !state.waterfallPaused });
  },
  
  clearWaterfall: () => {
    const newHistory: number[][] = [];
    for (let i = 0; i < SPECTRUM_HISTORY_LENGTH; i++) {
      newHistory.push(new Array(SPECTRUM_BIN_COUNT).fill(0));
    }
    set({
      spectrumHistory: newHistory,
      waterfallStartTime: Date.now(),
    });
  },
  
  exportSpectrumData: () => {
    const state = get();
    exportSpectrumToCSV(state.spectrumHistory, state.frequency, state.waterfallStartTime);
  },
  
  addObservationTask: (task) => {
    const newTask: ObservationTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      progress: 0,
      startTime: null,
      endTime: null,
    };
    
    set(state => ({
      observationTasks: [...state.observationTasks, newTask],
    }));
  },
  
  removeObservationTask: (taskId: string) => {
    set(state => ({
      observationTasks: state.observationTasks.filter(t => t.id !== taskId),
    }));
  },
  
  startObservationQueue: async () => {
    const state = get();
    if (state.observationTasks.length === 0) return;
    
    taskQueueRunning = true;
    let startIndex = state.currentTaskIndex >= 0 ? state.currentTaskIndex : 0;
    
    for (let i = startIndex; i < state.observationTasks.length; i++) {
      if (!taskQueueRunning) break;
      
      const task = state.observationTasks[i];
      if (task.status === 'completed') continue;
      
      set({ currentTaskIndex: i });
      
      set(state => ({
        observationTasks: state.observationTasks.map((t, idx) =>
          idx === i ? { ...t, status: 'running' as const, progress: 0 } : t
        ),
      }));
      
      const result = task.targetStarId
        ? await get().setTargetByStar(ALL_STARS.find(s => s.id === task.targetStarId)!)
        : await get().setTargetByRADec(task.targetRA, task.targetDec);
      
      if (!result.success) {
        set(state => ({
          observationTasks: state.observationTasks.map((t, idx) =>
            idx === i ? {
              ...t,
              status: 'failed' as const,
              endTime: Date.now(),
              error: result.message || '目标不可观测',
            } : t
          ),
        }));
        continue;
      }
      
      if (task.recordData && state.taskAutoRecord) {
        get().toggleRecording();
      }
      
      set(state => ({
        observationTasks: state.observationTasks.map((t, idx) =>
          idx === i ? { ...t, startTime: Date.now() } : t
        ),
      }));
      
      accumulatedSNR = 0;
      accumulatedSignalStrength = 0;
      peakFrequency = 0;
      taskDataPoints = 0;
      
      await new Promise(resolve => setTimeout(resolve, task.duration * 1000));
      
      if (!taskQueueRunning) break;
      
      get()._completeCurrentTask();
    }
    
    if (taskQueueRunning) {
      taskQueueRunning = false;
      set({ currentTaskIndex: -1 });
    }
  },
  
  stopObservationQueue: () => {
    taskQueueRunning = false;
    
    const state = get();
    if (state.isRecording) {
      get().toggleRecording();
    }
    
    set(state => ({
      observationTasks: state.observationTasks.map((t, i) =>
        i === state.currentTaskIndex && t.status === 'running'
          ? { ...t, status: 'skipped' as const, endTime: Date.now() }
          : t
      ),
      currentTaskIndex: -1,
    }));
  },
  
  clearObservationQueue: () => {
    taskQueueRunning = false;
    set({
      observationTasks: [],
      currentTaskIndex: -1,
    });
  },
  
  moveTaskUp: (taskId: string) => {
    set(state => {
      const idx = state.observationTasks.findIndex(t => t.id === taskId);
      if (idx <= 0) return state;
      
      const newTasks = [...state.observationTasks];
      [newTasks[idx - 1], newTasks[idx]] = [newTasks[idx], newTasks[idx - 1]];
      return { observationTasks: newTasks };
    });
  },
  
  moveTaskDown: (taskId: string) => {
    set(state => {
      const idx = state.observationTasks.findIndex(t => t.id === taskId);
      if (idx < 0 || idx >= state.observationTasks.length - 1) return state;
      
      const newTasks = [...state.observationTasks];
      [newTasks[idx], newTasks[idx + 1]] = [newTasks[idx + 1], newTasks[idx]];
      return { observationTasks: newTasks };
    });
  },
  
  _completeCurrentTask: () => {
    const state = get();
    const currentTask = state.observationTasks[state.currentTaskIndex];
    
    if (currentTask && currentTask.status === 'running') {
      if (state.isRecording) {
        get().toggleRecording();
      }
      
      const result = {
        avgSNR: taskDataPoints > 0 ? accumulatedSNR / taskDataPoints : 0,
        avgSignalStrength: taskDataPoints > 0 ? accumulatedSignalStrength / taskDataPoints : 0,
        peakFrequency,
        dataPoints: taskDataPoints,
      };
      
      set(state => ({
        observationTasks: state.observationTasks.map((t, i) =>
          i === state.currentTaskIndex
            ? { ...t, status: 'completed' as const, progress: 100, endTime: Date.now(), result }
            : t
        ),
      }));
    }
  },
}));

export function useTelescopeTrackingLoop() {
  const updateSignalData = useTelescopeStore(state => state.updateSignalData);
  
  return { updateSignalData };
}
