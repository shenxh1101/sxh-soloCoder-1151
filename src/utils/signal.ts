import type { WeatherType, SignalMode } from '@/types';

const WEATHER_ATTENUATION: Record<WeatherType, number> = {
  clear: 0.5,
  fog: 3.5,
  rain: 10,
};

const WEATHER_NOISE: Record<WeatherType, number> = {
  clear: 0.1,
  fog: 0.25,
  rain: 0.5,
};

export function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function generateWaveform(
  sampleCount: number,
  frequency: number,
  gain: number,
  signalMode: SignalMode,
  weather: WeatherType,
  pointingError: number,
  timestamp: number,
  isPulsarTarget: boolean = false
): { waveform: number[]; signalStrength: number; snr: number } {
  const waveform: number[] = [];
  const attenuation = WEATHER_ATTENUATION[weather];
  const noiseLevel = WEATHER_NOISE[weather];
  const beamWidth = 0.5;
  
  const pointingLoss = Math.min(1, Math.exp(-(pointingError * pointingError) / (2 * beamWidth * beamWidth)));
  const weatherLoss = Math.pow(10, -attenuation / 20);
  const gainFactor = Math.pow(10, gain / 20);
  const signalAmplitude = 0.8 * pointingLoss * weatherLoss * gainFactor;
  const noiseAmplitude = noiseLevel * (1 + gain * 0.02);
  
  const angularFreq = 2 * Math.PI * frequency;
  
  for (let i = 0; i < sampleCount; i++) {
    const t = timestamp + i * 0.001;
    let signal = 0;
    
    if (signalMode === 'sine') {
      if (isPulsarTarget) {
        const pulsePeriod = 0.714;
        const phase = (t % pulsePeriod) / pulsePeriod;
        const pulse = Math.exp(-(phase - 0.1) * (phase - 0.1) / 0.002);
        signal = signalAmplitude * pulse * Math.sin(angularFreq * t);
      } else {
        signal = signalAmplitude * Math.sin(angularFreq * t);
      }
    } else if (signalMode === 'pulse') {
      const pulsePeriod = 0.02;
      const phase = (t % pulsePeriod) / pulsePeriod;
      const pulse = Math.exp(-(phase - 0.2) * (phase - 0.2) / 0.001);
      signal = signalAmplitude * pulse * Math.sin(angularFreq * t);
    }
    
    const noise = noiseAmplitude * gaussianRandom();
    waveform.push(signal + noise);
  }
  
  const signalStrength = signalAmplitude;
  const noisePower = noiseAmplitude * noiseAmplitude;
  const signalPower = signalStrength * signalStrength * 0.5;
  const snr = noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 0;
  
  return { waveform, signalStrength, snr };
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

export function valueToColor(value: number, minVal: number, maxVal: number): string {
  const normalized = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
  
  const h = (1 - normalized) * 240;
  const s = 80 + normalized * 20;
  const l = 20 + normalized * 60;
  
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function valueToRGB(value: number, minVal: number, maxVal: number): [number, number, number] {
  const normalized = Math.max(0, Math.min(1, (value - minVal) / (maxVal - minVal)));
  
  const h = (1 - normalized) * 240;
  const s = 0.8 + normalized * 0.2;
  const l = 0.2 + normalized * 0.6;
  
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
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export function calculateObservationQuality(
  weather: WeatherType,
  pointingError: number,
  gainDeviation: number
): number {
  const w1 = 0.5;
  const w2 = 0.3;
  const w3 = 0.2;
  
  const weatherScore = 1 - WEATHER_ATTENUATION[weather] / 20;
  const pointingScore = Math.max(0, 1 - Math.abs(pointingError) / 1);
  const gainScore = Math.max(0, 1 - Math.abs(gainDeviation) / 20);
  
  return Math.round(100 * (w1 * weatherScore + w2 * pointingScore + w3 * gainScore));
}
