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
  
  isReplayMode: false,
  replayTaskId: null,
  replayTime: 0,
  replayPaused: false,
  replayPeakFrequency: 0,
  realtimeSnapshot: null,
  
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
    
    if (state.isReplayMode) {
      return;
    }
    
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
    const phaseTiming = {
      preparing: 2,
      calibrating: 3,
      observing: task.duration,
      wrapping: 1,
    };
    
    const newTask: ObservationTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      progress: 0,
      observationProgress: 0,
      currentPhase: 'idle',
      phaseProgress: 0,
      startTime: null,
      endTime: null,
      phaseTiming,
      phaseStartTimes: {
        preparing: null,
        calibrating: null,
        observing: null,
        wrapping: null,
      },
      timeSeriesData: {
        timestamps: [],
        snr: [],
        signalStrength: [],
        pointingError: [],
        quality: [],
        peakFrequency: [],
        weather: [],
        noiseFloor: [],
        spectrum: [],
      },
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
          idx === i ? { 
            ...t, 
            status: 'running' as const, 
            progress: 0,
            currentPhase: 'preparing' as const,
            phaseProgress: 0,
            startTime: Date.now(),
            phaseStartTimes: {
              ...t.phaseStartTimes,
              preparing: Date.now(),
            },
          } : t
        ),
      }));
      
      const { observing: observeDuration, calibrating: calibrateDuration, preparing: prepareDuration, wrapping: wrapDuration } = task.phaseTiming;
      
      // ========== 准备阶段：转向目标 ==========
      const slewResult = task.targetStarId
        ? await get().setTargetByStar(ALL_STARS.find(s => s.id === task.targetStarId)!)
        : await get().setTargetByRADec(task.targetRA, task.targetDec);
      
      // 检查目标当前是否可观测（哪怕转向过程中已经偏出波束）
      const { altitude: currentTargetAlt } = equatorialToHorizontal(task.targetRA, task.targetDec);
      const targetIsObservable = currentTargetAlt >= TELESCOPE_CONFIG.minAltitude && currentTargetAlt <= TELESCOPE_CONFIG.maxAltitude;
      
      // 只有目标不可观测时才标记失败，否则继续进入校准阶段持续修正
      if (!slewResult.success && !targetIsObservable) {
        set(state => ({
          observationTasks: state.observationTasks.map((t, idx) =>
            idx === i ? {
              ...t,
              status: 'failed' as const,
              endTime: Date.now(),
              currentPhase: 'idle' as const,
              error: slewResult.message || '目标不可观测',
            } : t
          ),
        }));
        continue;
      }
      
      // 等待准备阶段时间完成（至少等转向完成）
      const prepareStart = Date.now();
      while (Date.now() - prepareStart < prepareDuration * 1000) {
        if (!taskQueueRunning) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!taskQueueRunning) break;
      
      // ========== 校准阶段：持续修正，确保目标稳定在波束内 ==========
      set(state => ({
        observationTasks: state.observationTasks.map((t, idx) =>
          idx === i ? {
            ...t,
            currentPhase: 'calibrating' as const,
            phaseProgress: 0,
            phaseStartTimes: {
              ...t.phaseStartTimes,
              calibrating: Date.now(),
            },
          } : t
        ),
      }));
      
      set({ trackingStatus: 'calibrating' });
      
      const calibrateStart = Date.now();
      const maxCalibrateDuration = Math.max(calibrateDuration * 1000, 10000); // 至少10秒校准时间
      let stableStartTime = 0;
      let lastInBeam = false;
      let calibrationSuccessful = false;
      
      while (Date.now() - calibrateStart < maxCalibrateDuration) {
        if (!taskQueueRunning) break;
        
        const currentState = get();
        const currentTask = currentState.observationTasks[i];
        if (!currentTask || currentTask.status !== 'running') break;
        
        // 实时更新目标位置（因为地球自转）
        const { azimuth: targetAz, altitude: targetAlt } = equatorialToHorizontal(currentTask.targetRA, currentTask.targetDec);
        const isObservable = targetAlt >= TELESCOPE_CONFIG.minAltitude && targetAlt <= TELESCOPE_CONFIG.maxAltitude;
        
        if (!isObservable) {
          set(state => ({
            observationTasks: state.observationTasks.map((t, idx) =>
              idx === i ? {
                ...t,
                status: 'failed' as const,
                endTime: Date.now(),
                currentPhase: 'idle' as const,
                error: '目标在天空中移动出了可观测范围',
              } : t
            ),
          }));
          break;
        }
        
        // 持续修正指向 - 只要有偏差就修正
        const distance = angularDistanceDeg(currentState.azimuth, currentState.altitude, targetAz, targetAlt);
        if (distance > TELESCOPE_CONFIG.beamWidth * 0.3) {
          motionState = {
            startAz: currentState.azimuth,
            startAlt: currentState.altitude,
            targetAz: normalizeAzimuth(targetAz),
            targetAlt: clampAltitude(targetAlt),
            progress: 0,
            duration: Math.max(0.2, distance / TELESCOPE_CONFIG.maxSpeed / 2),
          };
          set({ trackingStatus: 'calibrating' });
          stableStartTime = 0;
        }
        
        // 检查是否稳定在波束内
        const inBeam = currentState.pointingInfo.inBeam && currentState.pointingInfo.isObservable;
        if (inBeam && lastInBeam) {
          if (stableStartTime === 0) {
            stableStartTime = Date.now();
          }
        } else {
          stableStartTime = 0;
        }
        lastInBeam = inBeam;
        
        // 如果已经稳定在波束内超过1.5秒，就可以进入观测阶段
        if (stableStartTime > 0 && Date.now() - stableStartTime > 1500) {
          calibrationSuccessful = true;
          break;
        }
        
        // 更新校准进度
        const calElapsed = (Date.now() - calibrateStart) / 1000;
        const calProgress = Math.min(100, (calElapsed / (maxCalibrateDuration / 1000)) * 100);
        const totalProgress = (prepareDuration + calElapsed) / (prepareDuration + (maxCalibrateDuration / 1000) + observeDuration + wrapDuration) * 100;
        
        set(state => ({
          observationTasks: state.observationTasks.map((t, idx) =>
            idx === i ? {
              ...t,
              phaseProgress: calProgress,
              progress: Math.min(100, totalProgress),
            } : t
          ),
        }));
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!taskQueueRunning) break;
      
      const currentTaskAfterCal = get().observationTasks[i];
      if (currentTaskAfterCal?.status === 'failed') continue;
      
      // 如果校准时间用完还没稳定，再做最后一次修正
      if (!calibrationSuccessful) {
        const { azimuth: tAz, altitude: tAlt } = equatorialToHorizontal(currentTaskAfterCal.targetRA, currentTaskAfterCal.targetDec);
        motionState = {
          startAz: get().azimuth,
          startAlt: get().altitude,
          targetAz: normalizeAzimuth(tAz),
          targetAlt: clampAltitude(tAlt),
          progress: 0,
          duration: 0.8,
        };
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // ========== 观测阶段：正式记录数据 ==========
      if (task.recordData && state.taskAutoRecord) {
        get().toggleRecording();
      }
      
      set(state => ({
        observationTasks: state.observationTasks.map((t, idx) =>
          idx === i ? {
            ...t,
            currentPhase: 'observing' as const,
            phaseProgress: 0,
            phaseStartTimes: {
              ...t.phaseStartTimes,
              observing: Date.now(),
            },
          } : t
        ),
      }));
      
      set({ trackingStatus: 'tracking' });
      
      accumulatedSNR = 0;
      accumulatedSignalStrength = 0;
      peakFrequency = 0;
      taskDataPoints = 0;
      let maxSNR = -Infinity;
      let minSNR = Infinity;
      
      const observeStart = Date.now();
      
      while (Date.now() - observeStart < observeDuration * 1000) {
        if (!taskQueueRunning) break;
        
        // 持续跟踪修正
        const currentState = get();
        const currentTask = currentState.observationTasks[i];
        if (!currentTask || currentTask.status !== 'running') break;
        
        const { azimuth: tAz, altitude: tAlt } = equatorialToHorizontal(currentTask.targetRA, currentTask.targetDec);
        const dist = angularDistanceDeg(currentState.azimuth, currentState.altitude, tAz, tAlt);
        
        if (dist > TELESCOPE_CONFIG.beamWidth * 0.3) {
          motionState = {
            startAz: currentState.azimuth,
            startAlt: currentState.altitude,
            targetAz: normalizeAzimuth(tAz),
            targetAlt: clampAltitude(tAlt),
            progress: 0,
            duration: Math.max(0.2, dist / TELESCOPE_CONFIG.maxSpeed / 2),
          };
        }
        
        // 收集时间序列数据
        const snr = currentState.currentSNR;
        if (snr > maxSNR) maxSNR = snr;
        if (snr < minSNR) minSNR = snr;
        
        const obsElapsed = (Date.now() - observeStart) / 1000;
        const obsProgress = Math.min(100, (obsElapsed / observeDuration) * 100);
        const totalProgress = (prepareDuration + calibrateDuration + obsElapsed) / (prepareDuration + calibrateDuration + observeDuration + wrapDuration) * 100;
        
        // 更新时间序列数据（每秒一个数据点）
        const dataIdx = Math.floor(obsElapsed);
        const timeData = currentTask.timeSeriesData;
        if (timeData && dataIdx >= timeData.timestamps.length) {
          const currentSpectrum = currentState.spectrumHistory.length > 0 
            ? [...currentState.spectrumHistory[0]] 
            : [];
          
          set(state => ({
            observationTasks: state.observationTasks.map((t, idx) => {
              if (idx !== i || !t.timeSeriesData) return t;
              return {
                ...t,
                phaseProgress: obsProgress,
                observationProgress: obsProgress,
                progress: Math.min(100, totalProgress),
                timeSeriesData: {
                  timestamps: [...t.timeSeriesData.timestamps, Date.now()],
                  snr: [...t.timeSeriesData.snr, state.currentSNR],
                  signalStrength: [...t.timeSeriesData.signalStrength, state.currentSignalStrength],
                  pointingError: [...t.timeSeriesData.pointingError, state.pointingInfo.pointingError],
                  quality: [...t.timeSeriesData.quality, state.observationQuality],
                  peakFrequency: [...t.timeSeriesData.peakFrequency, peakFrequency],
                  weather: [...t.timeSeriesData.weather, state.weather],
                  noiseFloor: [...t.timeSeriesData.noiseFloor, state.noiseFloor],
                  spectrum: [...t.timeSeriesData.spectrum, currentSpectrum],
                },
              };
            }),
          }));
        } else {
          set(state => ({
            observationTasks: state.observationTasks.map((t, idx) =>
              idx === i ? {
                ...t,
                phaseProgress: obsProgress,
                observationProgress: obsProgress,
                progress: Math.min(100, totalProgress),
              } : t
            ),
          }));
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!taskQueueRunning) break;
      
      // ========== 收尾阶段：停止记录，整理数据 ==========
      set(state => ({
        observationTasks: state.observationTasks.map((t, idx) =>
          idx === i ? {
            ...t,
            currentPhase: 'wrapping' as const,
            phaseProgress: 0,
            phaseStartTimes: {
              ...t.phaseStartTimes,
              wrapping: Date.now(),
            },
          } : t
        ),
      }));
      
      // 停止记录
      if (task.recordData && state.taskAutoRecord && get().isRecording) {
        get().toggleRecording();
      }
      
      // 收尾阶段：保存结果
      const wrapStart = Date.now();
      while (Date.now() - wrapStart < wrapDuration * 1000) {
        if (!taskQueueRunning) break;
        
        const wrapElapsed = (Date.now() - wrapStart) / 1000;
        const wrapProgress = Math.min(100, (wrapElapsed / wrapDuration) * 100);
        const totalProgress = (prepareDuration + calibrateDuration + observeDuration + wrapElapsed) / (prepareDuration + calibrateDuration + observeDuration + wrapDuration) * 100;
        
        set(state => ({
          observationTasks: state.observationTasks.map((t, idx) =>
            idx === i ? {
              ...t,
              phaseProgress: wrapProgress,
              progress: Math.min(100, totalProgress),
            } : t
          ),
        }));
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!taskQueueRunning) break;
      
      // 完成任务
      const finalResult = {
        avgSNR: taskDataPoints > 0 ? accumulatedSNR / taskDataPoints : 0,
        avgSignalStrength: taskDataPoints > 0 ? accumulatedSignalStrength / taskDataPoints : 0,
        peakFrequency,
        dataPoints: taskDataPoints,
        maxSNR: maxSNR === -Infinity ? 0 : maxSNR,
        minSNR: minSNR === Infinity ? 0 : minSNR,
      };
      
      set(state => ({
        observationTasks: state.observationTasks.map((t, idx) =>
          idx === i ? {
            ...t,
            status: 'completed' as const,
            progress: 100,
            currentPhase: 'idle' as const,
            phaseProgress: 100,
            endTime: Date.now(),
            result: finalResult,
          } : t
        ),
      }));
    }
    
    if (taskQueueRunning) {
      taskQueueRunning = false;
      set({ currentTaskIndex: -1, trackingStatus: 'idle' });
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
        maxSNR: 0,
        minSNR: 0,
      };
      
      set(state => ({
        observationTasks: state.observationTasks.map((t, i) =>
          i === state.currentTaskIndex
            ? { ...t, status: 'completed' as const, progress: 100, currentPhase: 'idle' as const, phaseProgress: 100, endTime: Date.now(), result }
            : t
        ),
      }));
    }
  },
  
  startReplay: (taskId: string) => {
    const state = get();
    const task = state.observationTasks.find(t => t.id === taskId);
    
    if (!task || !task.timeSeriesData || task.timeSeriesData.timestamps.length === 0) {
      return;
    }
    
    taskQueueRunning = false;
    
    const realtimeSnapshot = {
      waveformData: [...state.waveformData],
      spectrumHistory: state.spectrumHistory.map(s => [...s]),
      currentSignalStrength: state.currentSignalStrength,
      currentSNR: state.currentSNR,
      noiseFloor: state.noiseFloor,
      observationQuality: state.observationQuality,
      pointingError: state.pointingError,
      weather: state.weather,
      trackingStatus: state.trackingStatus,
      azimuth: state.azimuth,
      altitude: state.altitude,
      targetRA: state.targetRA,
      targetDec: state.targetDec,
      selectedStarId: state.selectedStarId,
    };
    
    set({
      isReplayMode: true,
      replayTaskId: taskId,
      replayTime: 0,
      replayPaused: false,
      replayPeakFrequency: task.result?.peakFrequency || 0,
      realtimeSnapshot,
      trackingStatus: 'tracking',
      targetRA: task.targetRA,
      targetDec: task.targetDec,
      selectedStarId: task.targetStarId || null,
    });
  },
  
  stopReplay: () => {
    const state = get();
    const snapshot = state.realtimeSnapshot;
    
    if (snapshot) {
      set({
        isReplayMode: false,
        replayTaskId: null,
        replayTime: 0,
        replayPaused: false,
        replayPeakFrequency: 0,
        realtimeSnapshot: null,
        waveformData: snapshot.waveformData,
        spectrumHistory: snapshot.spectrumHistory,
        currentSignalStrength: snapshot.currentSignalStrength,
        currentSNR: snapshot.currentSNR,
        noiseFloor: snapshot.noiseFloor,
        observationQuality: snapshot.observationQuality,
        pointingError: snapshot.pointingError,
        weather: snapshot.weather,
        trackingStatus: snapshot.trackingStatus,
        azimuth: snapshot.azimuth,
        altitude: snapshot.altitude,
        targetRA: snapshot.targetRA,
        targetDec: snapshot.targetDec,
        selectedStarId: snapshot.selectedStarId,
      });
    } else {
      set({
        isReplayMode: false,
        replayTaskId: null,
        replayTime: 0,
        replayPaused: false,
        replayPeakFrequency: 0,
        realtimeSnapshot: null,
        trackingStatus: 'idle',
      });
    }
  },
  
  setReplayTime: (time: number) => {
    const state = get();
    const task = state.observationTasks.find(t => t.id === state.replayTaskId);
    
    if (!task || !task.timeSeriesData) return;
    
    const dataLength = task.timeSeriesData.timestamps.length;
    const dataIndex = Math.min(Math.max(0, Math.floor(time)), dataLength - 1);
    
    if (dataIndex >= 0 && dataIndex < task.timeSeriesData.snr.length) {
      const snr = task.timeSeriesData.snr[dataIndex];
      const signalStrength = task.timeSeriesData.signalStrength[dataIndex];
      const pointingError = task.timeSeriesData.pointingError[dataIndex];
      const quality = task.timeSeriesData.quality[dataIndex];
      const peakFreq = task.timeSeriesData.peakFrequency?.[dataIndex] || state.frequency;
      const weather = task.timeSeriesData.weather?.[dataIndex] || state.weather;
      const noise = task.timeSeriesData.noiseFloor?.[dataIndex] || 0.1;
      
      // 构建回放波形
      const waveformSamples = 256;
      const replayWaveform = new Float32Array(waveformSamples);
      const seed = dataIndex * 1000;
      for (let i = 0; i < waveformSamples; i++) {
        const t = i / waveformSamples;
        const signal = Math.sin(t * Math.PI * 2 * 20 + seed) * signalStrength;
        const noiseVal = (Math.sin(seed + i * 0.37) + Math.sin(seed * 1.7 + i * 0.91)) * 0.5 * noise;
        replayWaveform[i] = signal + noiseVal;
      }
      
      // 构建瀑布图历史
      const spectrumHistory: number[][] = [];
      const histLength = Math.min(dataIndex + 1, 128);
      for (let i = 0; i < histLength; i++) {
        const idx = dataIndex - histLength + 1 + i;
        if (idx >= 0 && task.timeSeriesData.spectrum?.[idx]) {
          spectrumHistory.push(task.timeSeriesData.spectrum[idx]);
        }
      }
      
      set({
        replayTime: time,
        currentSNR: snr,
        currentSignalStrength: signalStrength,
        pointingError,
        observationQuality: quality,
        waveformData: Array.from(replayWaveform),
        spectrumHistory: spectrumHistory.length > 0 ? spectrumHistory : state.spectrumHistory,
        noiseFloor: noise,
        weather,
        replayPeakFrequency: peakFreq,
      });
    }
  },
  
  toggleReplayPause: () => {
    const state = get();
    set({ replayPaused: !state.replayPaused });
  },
  
  updateReplay: (deltaTime: number) => {
    const state = get();
    if (!state.isReplayMode || state.replayPaused) return;
    
    const task = state.observationTasks.find(t => t.id === state.replayTaskId);
    if (!task || !task.timeSeriesData) return;
    
    const dataLength = task.timeSeriesData.timestamps.length;
    let newTime = state.replayTime + deltaTime;
    
    if (newTime >= dataLength) {
      newTime = dataLength - 1;
      set({ replayPaused: true, replayTime: newTime });
    } else {
      set({ replayTime: newTime });
    }
    
    const dataIndex = Math.floor(newTime);
    if (dataIndex >= 0 && dataIndex < task.timeSeriesData.snr.length) {
      const snr = task.timeSeriesData.snr[dataIndex];
      const signalStrength = task.timeSeriesData.signalStrength[dataIndex];
      const pointingError = task.timeSeriesData.pointingError[dataIndex];
      const quality = task.timeSeriesData.quality[dataIndex];
      const peakFreq = task.timeSeriesData.peakFrequency?.[dataIndex] || state.frequency;
      const weather = task.timeSeriesData.weather?.[dataIndex] || state.weather;
      const noise = task.timeSeriesData.noiseFloor?.[dataIndex] || 0.1;
      
      // 构建回放波形（基于历史强度 + 伪随机噪声，确保可重复）
      const waveformSamples = 256;
      const replayWaveform = new Float32Array(waveformSamples);
      const seed = dataIndex * 1000;
      for (let i = 0; i < waveformSamples; i++) {
        const t = i / waveformSamples;
        const signal = Math.sin(t * Math.PI * 2 * 20 + seed) * signalStrength;
        const noiseVal = (Math.sin(seed + i * 0.37) + Math.sin(seed * 1.7 + i * 0.91)) * 0.5 * noise;
        replayWaveform[i] = signal + noiseVal;
      }
      
      // 构建瀑布图历史（到当前时间点为止）
      const spectrumHistory: number[][] = [];
      const histLength = Math.min(dataIndex + 1, 128);
      for (let i = 0; i < histLength; i++) {
        const idx = dataIndex - histLength + 1 + i;
        if (idx >= 0 && task.timeSeriesData.spectrum?.[idx]) {
          spectrumHistory.push(task.timeSeriesData.spectrum[idx]);
        }
      }
      
      set({
        currentSNR: snr,
        currentSignalStrength: signalStrength,
        pointingError,
        observationQuality: quality,
        waveformData: Array.from(replayWaveform),
        spectrumHistory: spectrumHistory.length > 0 ? spectrumHistory : state.spectrumHistory,
        noiseFloor: noise,
        weather,
        replayPeakFrequency: peakFreq,
      });
    }
  },
}));

export function useTelescopeTrackingLoop() {
  const updateSignalData = useTelescopeStore(state => state.updateSignalData);
  
  return { updateSignalData };
}
