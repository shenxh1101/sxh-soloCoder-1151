import type { TelescopeConfig } from '@/types';

export const TELESCOPE_CONFIG: TelescopeConfig = {
  diameter: 500,
  focalLength: 140,
  feedHeight: 140,
  minAltitude: 10,
  maxAltitude: 80,
  maxSpeed: 1.0,
  observationLatitude: 25.6528,
  observationLongitude: 106.8564,
};

export const SCALE_FACTOR = 0.05;

export const TOWER_POSITIONS = [
  { angle: 0, radius: 560, height: 115 },
  { angle: 60, radius: 560, height: 115 },
  { angle: 120, radius: 560, height: 115 },
  { angle: 180, radius: 560, height: 115 },
  { angle: 240, radius: 560, height: 115 },
  { angle: 300, radius: 560, height: 115 },
].map(t => ({
  x: Math.cos((t.angle * Math.PI) / 180) * t.radius * SCALE_FACTOR,
  y: t.height * SCALE_FACTOR,
  z: Math.sin((t.angle * Math.PI) / 180) * t.radius * SCALE_FACTOR,
}));

export const COLORS = {
  space: '#0a0e1a',
  panel: 'rgba(26, 31, 46, 0.85)',
  border: 'rgba(0, 212, 255, 0.3)',
  signal: '#00d4ff',
  warning: '#ffaa00',
  success: '#00ff88',
  error: '#ff4444',
  metal: '#8b95a5',
  dish: '#a0a8b4',
  feed: '#c0c8d4',
  cable: '#6b7280',
};

export const WAVEFORM_SAMPLE_COUNT = 512;
export const SPECTRUM_BIN_COUNT = 256;
export const SPECTRUM_HISTORY_LENGTH = 128;
export const SIGNAL_SAMPLE_RATE = 1000;
