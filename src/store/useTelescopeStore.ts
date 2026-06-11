import { create } from 'zustand';
import type { TelescopeState, WeatherType, SignalMode, StarData, RecordedData } from '@/types';
import { WAVEFORM_SAMPLE_COUNT, SPECTRUM_BIN_COUNT, SPECTRUM_HISTORY_LENGTH, TELESCOPE_CONFIG } from '@/data/config';
import { altAzToFeedPosition, clampAltitude, normalizeAzimuth, angularDistanceDeg, lerpAngle, easeInOutCubic } from '@/utils/coordinates';
import { equatorialToHorizontal, horizontalToEquatorial, EARTH_ROTATION_RATE, angularDistance } from '@/utils/astronomy';
import { generateWaveform, computeFFT, calculateObservationQuality } from '@/utils/signal';
import { exportToCSV } from '@/utils/csv';
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

let motionState: MotionState | null = null;
let lastUpdateTime = performance.now();
let waveformTimestamp = 0;

export const useTelescopeStore = create<TelescopeState>((set, get) => ({
  azimuth: initialAzimuth,
  altitude: initialAltitude,
  targetRA: 12,
  targetDec: 0,
  selectedStarId: null,
  feedPosition: initialFeedPos,
  trackingStatus: 'idle',
  
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
      trackingStatus: 'moving',
      targetRA: ra,
      targetDec: dec,
      selectedStarId: null,
    });
  },
  
  setTargetByRADec: (ra: number, dec: number) => {
    const { azimuth, altitude } = equatorialToHorizontal(ra, dec);
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
      trackingStatus: 'moving',
      targetRA: ra,
      targetDec: dec,
      selectedStarId: null,
    });
  },
  
  setTargetByStar: (star: StarData) => {
    const { azimuth, altitude } = equatorialToHorizontal(star.ra, star.dec);
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
      trackingStatus: 'moving',
      targetRA: star.ra,
      targetDec: star.dec,
      selectedStarId: star.id,
      signalMode: star.isPulsar ? 'pulse' : state.signalMode,
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
    set({
      driftScanMode: !state.driftScanMode,
      driftScanStartTime: !state.driftScanMode ? performance.now() : null,
      trackingStatus: !state.driftScanMode ? 'drifting' : (motionState ? 'moving' : 'tracking'),
    });
  },
  
  updateTracking: (deltaTime: number) => {
    const state = get();
    
    if (state.driftScanMode) {
      const driftAmount = state.driftScanRate * deltaTime;
      const newAz = normalizeAzimuth(state.azimuth - driftAmount);
      const newFeedPos = altAzToFeedPosition(newAz, state.altitude);
      
      const { ra, dec } = horizontalToEquatorial(newAz, state.altitude);
      
      set({
        azimuth: newAz,
        feedPosition: newFeedPos,
        targetRA: ra,
        targetDec: dec,
      });
      return;
    }
    
    if (motionState) {
      motionState.progress += deltaTime / motionState.duration;
      
      if (motionState.progress >= 1) {
        const finalAz = motionState.targetAz;
        const finalAlt = motionState.targetAlt;
        const newFeedPos = altAzToFeedPosition(finalAz, finalAlt);
        
        motionState = null;
        
        set({
          azimuth: finalAz,
          altitude: finalAlt,
          feedPosition: newFeedPos,
          trackingStatus: 'tracking',
        });
      } else {
        const t = easeInOutCubic(motionState.progress);
        const currentAz = lerpAngle(motionState.startAz, motionState.targetAz, t);
        const currentAlt = motionState.startAlt + (motionState.targetAlt - motionState.startAlt) * t;
        const newFeedPos = altAzToFeedPosition(currentAz, currentAlt);
        
        set({
          azimuth: currentAz,
          altitude: currentAlt,
          feedPosition: newFeedPos,
        });
      }
    } else if (state.selectedStarId) {
      const star = ALL_STARS.find(s => s.id === state.selectedStarId);
      if (star) {
        const { azimuth, altitude } = equatorialToHorizontal(star.ra, star.dec);
        const targetAz = normalizeAzimuth(azimuth);
        const targetAlt = clampAltitude(altitude);
        
        const currentAz = state.azimuth;
        const currentAlt = state.altitude;
        const distance = angularDistanceDeg(currentAz, currentAlt, targetAz, targetAlt);
        
        if (distance > 0.01) {
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
          });
        }
      }
    }
  },
  
  updateSignalData: () => {
    const state = get();
    const now = performance.now();
    const delta = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;
    
    get().updateTracking(delta);
    
    waveformTimestamp += delta;
    
    let pointingError = 0;
    if (state.selectedStarId) {
      const star = ALL_STARS.find(s => s.id === state.selectedStarId);
      if (star) {
        const { azimuth: targetAz, altitude: targetAlt } = equatorialToHorizontal(star.ra, star.dec);
        pointingError = angularDistanceDeg(state.azimuth, state.altitude, targetAz, targetAlt);
      }
    } else {
      pointingError = angularDistance(state.targetRA, state.targetDec, state.targetRA, state.targetDec);
    }
    
    const isPulsarTarget = state.selectedStarId 
      ? ALL_STARS.find(s => s.id === state.selectedStarId)?.isPulsar || false
      : false;
    
    const { waveform, signalStrength, snr } = generateWaveform(
      WAVEFORM_SAMPLE_COUNT,
      state.frequency / 1000,
      state.gain,
      state.signalMode,
      state.weather,
      pointingError,
      waveformTimestamp,
      isPulsarTarget
    );
    
    const spectrum = computeFFT(waveform);
    const resampledSpectrum: number[] = [];
    const step = spectrum.length / SPECTRUM_BIN_COUNT;
    for (let i = 0; i < SPECTRUM_BIN_COUNT; i++) {
      const idx = Math.floor(i * step);
      resampledSpectrum.push(spectrum[idx] || 0);
    }
    
    const newHistory = [resampledSpectrum, ...state.spectrumHistory.slice(0, -1)];
    
    const quality = calculateObservationQuality(state.weather, pointingError, state.gain - 30);
    
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
      };
      newRecordedData = [...state.recordedData, record].slice(-1000);
    }
    
    set({
      waveformData: waveform,
      spectrumHistory: newHistory,
      currentSignalStrength: signalStrength,
      currentSNR: snr,
      observationQuality: quality,
      recordedData: newRecordedData,
    });
  },
  
  exportCSV: () => {
    const state = get();
    exportToCSV(state.recordedData);
  },
  
  resetView: () => {
    motionState = {
      startAz: get().azimuth,
      startAlt: get().altitude,
      targetAz: initialAzimuth,
      targetAlt: initialAltitude,
      progress: 0,
      duration: 2,
    };
    
    set({
      trackingStatus: 'moving',
      targetRA: 12,
      targetDec: 0,
      selectedStarId: null,
      driftScanMode: false,
      driftScanStartTime: null,
    });
  },
}));

export function useTelescopeTrackingLoop() {
  const updateSignalData = useTelescopeStore(state => state.updateSignalData);
  
  return { updateSignalData };
}
