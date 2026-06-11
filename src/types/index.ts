export type WeatherType = 'clear' | 'fog' | 'rain';
export type SignalMode = 'sine' | 'pulse';
export type TrackingStatus = 'idle' | 'moving' | 'tracking' | 'drifting';

export interface StarData {
  id: string;
  name: string;
  ra: number;
  dec: number;
  magnitude: number;
  color: string;
  isPulsar?: boolean;
}

export interface TelescopeConfig {
  diameter: number;
  focalLength: number;
  feedHeight: number;
  minAltitude: number;
  maxAltitude: number;
  maxSpeed: number;
  observationLatitude: number;
  observationLongitude: number;
}

export interface FeedPosition {
  x: number;
  y: number;
  z: number;
}

export interface SignalSample {
  timestamp: number;
  value: number;
  frequency: number;
  gain: number;
}

export interface SpectrumData {
  timestamp: number;
  frequencies: number[];
  values: number[];
}

export interface WeatherEffect {
  attenuation: number;
  noiseIncrease: number;
  visibility: number;
}

export interface RecordedData {
  timestamp: number;
  ra: number;
  dec: number;
  azimuth: number;
  altitude: number;
  frequency: number;
  gain: number;
  signalStrength: number;
  snr: number;
  quality: number;
  weather: WeatherType;
}

export interface TelescopeState {
  azimuth: number;
  altitude: number;
  targetRA: number;
  targetDec: number;
  selectedStarId: string | null;
  feedPosition: FeedPosition;
  trackingStatus: TrackingStatus;
  
  frequency: number;
  gain: number;
  signalMode: SignalMode;
  
  waveformData: number[];
  spectrumHistory: number[][];
  isRecording: boolean;
  recordedData: RecordedData[];
  
  weather: WeatherType;
  observationQuality: number;
  
  driftScanMode: boolean;
  driftScanStartTime: number | null;
  driftScanRate: number;
  
  currentSignalStrength: number;
  currentSNR: number;
  
  setPointing: (az: number, alt: number) => void;
  setTargetByRADec: (ra: number, dec: number) => void;
  setTargetByStar: (star: StarData) => void;
  setSignalParams: (freq: number, gain: number) => void;
  setSignalMode: (mode: SignalMode) => void;
  toggleRecording: () => void;
  setWeather: (weather: WeatherType) => void;
  toggleDriftScan: () => void;
  updateTracking: (deltaTime: number) => void;
  updateSignalData: () => void;
  exportCSV: () => void;
  resetView: () => void;
}
