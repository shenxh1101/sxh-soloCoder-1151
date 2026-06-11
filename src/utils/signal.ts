import type { WeatherType, SignalMode } from '@/types';
import { TELESCOPE_CONFIG } from '@/data/config';

export const WEATHER_ATTENUATION: Record<WeatherType, number> = {
  clear: 0.5,
  fog: 3.5,
  rain: 10,
};

export const WEATHER_NOISE: Record<WeatherType, number> = {
  clear: 0.08,
  fog: 0.25,
  rain: 0.6,
};

export const WEATHER_SKY_BRIGHTNESS: Record<WeatherType, number> = {
  clear: 0.1,
  fog: 0.35,
  rain: 0.7,
};

export const WEATHER_VISIBILITY: Record<WeatherType, number> = {
  clear: 1.0,
  fog: 0.4,
  rain: 0.2,
};

export function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function beamResponse(angularDistance: number, beamWidth: number = TELESCOPE_CONFIG.beamWidth): number {
  const sigma = beamWidth / 2.355;
  const normalizedDistance = angularDistance / sigma;
  return Math.exp(-0.5 * normalizedDistance * normalizedDistance);
}

export function generateWaveform(
  sampleCount: number,
  frequency: number,
  gain: number,
  signalMode: SignalMode,
  weather: WeatherType,
  pointingError: number,
  timestamp: number,
  isPulsarTarget: boolean = false,
  beamDistance: number = 0,
  inBeam: boolean = true
): { waveform: number[]; signalStrength: number; snr: number; noiseFloor: number } {
  const waveform: number[] = [];
  const attenuation = WEATHER_ATTENUATION[weather];
  const noiseLevel = WEATHER_NOISE[weather];
  const skyBrightness = WEATHER_SKY_BRIGHTNESS[weather];
  const beamWidth = TELESCOPE_CONFIG.beamWidth;
  
  const beamGain = beamResponse(beamDistance, beamWidth);
  const weatherLoss = Math.pow(10, -attenuation / 20);
  const gainFactor = Math.pow(10, gain / 20);
  
  const inBeamFactor = inBeam ? 1.0 : 0.0;
  const baseSignalAmplitude = 0.8 * beamGain * weatherLoss * gainFactor * inBeamFactor;
  const noiseAmplitude = noiseLevel * (1 + gain * 0.02) * (1 + skyBrightness * 0.5);
  
  const angularFreq = 2 * Math.PI * frequency;
  
  const pulsarPeriod = 0.714;
  const pulseWidth = 0.05;
  
  let totalSignalPower = 0;
  let totalNoisePower = 0;
  
  for (let i = 0; i < sampleCount; i++) {
    const t = timestamp + i * 0.001;
    let signal = 0;
    
    if (inBeam && beamGain > 0.05) {
      if (signalMode === 'sine') {
        if (isPulsarTarget) {
          const phase = (t % pulsarPeriod) / pulsarPeriod;
          const pulse = Math.exp(-(phase - 0.1) * (phase - 0.1) / (pulseWidth * pulseWidth));
          signal = baseSignalAmplitude * pulse * Math.sin(angularFreq * t);
        } else {
          signal = baseSignalAmplitude * Math.sin(angularFreq * t);
        }
      } else if (signalMode === 'pulse') {
        const pulsePeriod = 0.02;
        const phase = (t % pulsePeriod) / pulsePeriod;
        const pulse = Math.exp(-(phase - 0.2) * (phase - 0.2) / 0.001);
        signal = baseSignalAmplitude * pulse * Math.sin(angularFreq * t);
      }
    }
    
    const skyNoise = skyBrightness * gainFactor * 0.1 * gaussianRandom();
    const receiverNoise = noiseAmplitude * gaussianRandom();
    const totalNoise = skyNoise + receiverNoise;
    
    const sample = signal + totalNoise;
    waveform.push(sample);
    
    totalSignalPower += signal * signal;
    totalNoisePower += totalNoise * totalNoise;
  }
  
  const signalStrength = baseSignalAmplitude;
  const avgSignalPower = totalSignalPower / sampleCount;
  const avgNoisePower = totalNoisePower / sampleCount;
  const noiseFloor = Math.sqrt(avgNoisePower);
  
  let snr = 0;
  if (avgNoisePower > 0) {
    snr = 10 * Math.log10(Math.max(0.001, avgSignalPower / avgNoisePower));
  }
  
  return { waveform, signalStrength, snr, noiseFloor };
}

export function computeFFT(data: number[]): number[] {
  const n = data.length;
  const spectrum: number[] = [];
  
  for (let k = 0; k < n / 2; k++) {
    let real = 0;
    let imag = 0;
    
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      real += data[t] * Math.cos(angle);
      imag += data[t] * Math.sin(angle);
    }
    
    const magnitude = Math.sqrt(real * real + imag * imag) / n;
    spectrum.push(magnitude);
  }
  
  return spectrum;
}

export function findPeakFrequency(spectrum: number[], freqMin: number, freqMax: number): { frequency: number; amplitude: number } {
  let maxIdx = 0;
  let maxVal = 0;
  
  for (let i = 0; i < spectrum.length; i++) {
    if (spectrum[i] > maxVal) {
      maxVal = spectrum[i];
      maxIdx = i;
    }
  }
  
  const frequency = freqMin + (freqMax - freqMin) * (maxIdx / spectrum.length);
  return { frequency, amplitude: maxVal };
}

export function valueToColor(value: number, minVal: number, maxVal: number): string {
  const normalized = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
  
  const h = (1 - normalized) * 240;
  const s = 80 + normalized * 20;
  const l = 20 + normalized * 60;
  
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function valueToRGB(value: number, minVal: number, maxVal: number, weather: WeatherType = 'clear'): [number, number, number] {
  const normalized = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
  
  const skyBrightness = WEATHER_SKY_BRIGHTNESS[weather];
  
  const h = (1 - normalized) * 240;
  const s = 0.8 + normalized * 0.2;
  const baseL = 0.15 + normalized * 0.6;
  const l = baseL + skyBrightness * 0.15;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  
  return [
    Math.min(255, Math.round((r + m) * 255)),
    Math.min(255, Math.round((g + m) * 255)),
    Math.min(255, Math.round((b + m) * 255)),
  ];
}

export function calculateObservationQuality(
  weather: WeatherType,
  pointingError: number,
  gainDeviation: number,
  inBeam: boolean,
  isObservable: boolean
): number {
  if (!isObservable) return 0;
  
  const w1 = 0.4;
  const w2 = 0.35;
  const w3 = 0.15;
  const w4 = 0.1;
  
  const weatherScore = 1 - WEATHER_ATTENUATION[weather] / 20;
  const pointingScore = Math.max(0, 1 - Math.abs(pointingError) / (TELESCOPE_CONFIG.beamWidth * 2));
  const gainScore = Math.max(0, 1 - Math.abs(gainDeviation) / 20);
  const beamScore = inBeam ? 1 : Math.max(0, 1 - Math.abs(pointingError) / TELESCOPE_CONFIG.beamWidth);
  
  const quality = 100 * (w1 * weatherScore + w2 * pointingScore + w3 * gainScore + w4 * beamScore);
  
  return Math.max(0, Math.min(100, Math.round(quality)));
}

export function calculateNoiseFloor(weather: WeatherType, gain: number): number {
  const noiseLevel = WEATHER_NOISE[weather];
  const skyBrightness = WEATHER_SKY_BRIGHTNESS[weather];
  const gainFactor = Math.pow(10, gain / 20);
  
  return noiseLevel * (1 + gain * 0.02) * (1 + skyBrightness * 0.5) * gainFactor;
}
