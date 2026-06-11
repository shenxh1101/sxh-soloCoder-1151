export type WeatherType = 'clear' | 'fog' | 'rain';
export type SignalMode = 'sine' | 'pulse';
export type TrackingStatus = 'idle' | 'moving' | 'acquiring' | 'tracking' | 'drifting' | 'unobservable' | 'slewing';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

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
  beamWidth: number;
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
  pointingError: number;
  targetInBeam: boolean;
}

export interface ObservationTask {
  id: string;
  name: string;
  targetRA: number;
  targetDec: number;
  targetStarId?: string;
  duration: number;
  recordData: boolean;
  status: TaskStatus;
  progress: number;
  startTime: number | null;
  endTime: number | null;
  result?: {
    avgSNR: number;
    avgSignalStrength: number;
    peakFrequency: number;
    dataPoints: number;
  };
  error?: string;
}

export interface PointingInfo {
  isObservable: boolean;
  reason?: string;
  pointingError: number;
  inBeam: boolean;
  beamDistance: number;
}

export interface TelescopeState {
  azimuth: number;
  altitude: number;
  targetRA: number;
  targetDec: number;
  selectedStarId: string | null;
  feedPosition: FeedPosition;
  trackingStatus: TrackingStatus;
  pointingInfo: PointingInfo;
  
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
  pointingError: number;
  noiseFloor: number;
  
  waterfallPaused: boolean;
  waterfallStartTime: number;
  
  observationTasks: ObservationTask[];
  currentTaskIndex: number;
  taskAutoRecord: boolean;
  
  setPointing: (az: number, alt: number) => void;
  setTargetByRADec: (ra: number, dec: number) => Promise<{ success: boolean; message?: string }>;
  setTargetByStar: (star: StarData) => Promise<{ success: boolean; message?: string }>;
  setSignalParams: (freq: number, gain: number) => void;
  setSignalMode: (mode: SignalMode) => void;
  toggleRecording: () => void;
  setWeather: (weather: WeatherType) => void;
  toggleDriftScan: () => void;
  updateTracking: (deltaTime: number) => void;
  updateSignalData: () => void;
  exportCSV: () => void;
  resetView: () => void;
  
  toggleWaterfallPause: () => void;
  clearWaterfall: () => void;
  exportSpectrumData: () => void;
  
  addObservationTask: (task: Omit<ObservationTask, 'id' | 'status' | 'progress' | 'startTime' | 'endTime'>) => void;
  removeObservationTask: (taskId: string) => void;
  startObservationQueue: () => void;
  stopObservationQueue: () => void;
  clearObservationQueue: () => void;
  moveTaskUp: (taskId: string) => void;
  moveTaskDown: (taskId: string) => void;
  _completeCurrentTask: () => void;
}
