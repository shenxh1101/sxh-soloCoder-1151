import { useRef, useEffect, useMemo } from 'react';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import { COLORS } from '@/data/config';
import { GlassPanel } from '@/components/UI/GlassPanel';
import { Activity, CloudRain, Cloud, Sun } from 'lucide-react';
import { WEATHER_SKY_BRIGHTNESS } from '@/utils/signal';

interface WaveformProps {
  className?: string;
}

export function Waveform({ className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const waveformData = useTelescopeStore(state => state.waveformData);
  const currentSignalStrength = useTelescopeStore(state => state.currentSignalStrength);
  const currentSNR = useTelescopeStore(state => state.currentSNR);
  const frequency = useTelescopeStore(state => state.frequency);
  const gain = useTelescopeStore(state => state.gain);
  const weather = useTelescopeStore(state => state.weather);
  const noiseFloor = useTelescopeStore(state => state.noiseFloor);
  const pointingInfo = useTelescopeStore(state => state.pointingInfo);
  
  const gridLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i <= 4; i++) {
      lines.push(i / 4);
    }
    return lines;
  }, []);
  
  const weatherIcon = weather === 'clear' ? <Sun size={12} className="text-yellow-400" /> :
    weather === 'fog' ? <Cloud size={12} className="text-orange-400" /> :
    <CloudRain size={12} className="text-blue-400" />;
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    
    const bgColor = weather === 'clear' ? '#0a0e1a' :
      weather === 'fog' ? '#1a1a12' : '#0d121a';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    const gridColor = weather === 'clear' ? 'rgba(0, 212, 255, 0.1)' :
      weather === 'fog' ? 'rgba(255, 200, 100, 0.1)' : 'rgba(100, 150, 255, 0.1)';
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    
    gridLines.forEach(yRatio => {
      ctx.beginPath();
      ctx.moveTo(0, yRatio * rect.height);
      ctx.lineTo(rect.width, yRatio * rect.height);
      ctx.stroke();
    });
    
    for (let i = 0; i <= 10; i++) {
      const xRatio = i / 10;
      ctx.beginPath();
      ctx.moveTo(xRatio * rect.width, 0);
      ctx.lineTo(xRatio * rect.width, rect.height);
      ctx.stroke();
    }
    
    const centerY = rect.height / 2;
    const amplitude = rect.height * 0.4;
    
    const noiseAmplitude = noiseFloor * amplitude;
    ctx.fillStyle = weather === 'clear' ? 'rgba(0, 212, 255, 0.05)' :
      weather === 'fog' ? 'rgba(255, 150, 50, 0.08)' : 'rgba(100, 150, 255, 0.08)';
    ctx.fillRect(0, centerY - noiseAmplitude, rect.width, noiseAmplitude * 2);
    
    ctx.strokeStyle = weather === 'clear' ? 'rgba(0, 212, 255, 0.3)' :
      weather === 'fog' ? 'rgba(255, 150, 50, 0.4)' : 'rgba(100, 150, 255, 0.4)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, centerY - noiseAmplitude);
    ctx.lineTo(rect.width, centerY - noiseAmplitude);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, centerY + noiseAmplitude);
    ctx.lineTo(rect.width, centerY + noiseAmplitude);
    ctx.stroke();
    ctx.setLineDash([]);
    
    if (waveformData.length > 0) {
      const signalColor = pointingInfo?.inBeam ? COLORS.signal :
        pointingInfo?.isObservable ? '#ffa500' : '#666666';
      
      ctx.beginPath();
      
      const step = rect.width / (waveformData.length - 1);
      
      for (let i = 0; i < waveformData.length; i++) {
        const x = i * step;
        const value = waveformData[i];
        const y = centerY - value * amplitude;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.strokeStyle = signalColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = signalColor;
      ctx.shadowBlur = pointingInfo?.inBeam ? 8 : 3;
      ctx.stroke();
      
      ctx.shadowBlur = 0;
      
      const gradientOpacity = pointingInfo?.inBeam ? 0.3 : 0.1;
      const gradient = ctx.createLinearGradient(0, centerY - amplitude, 0, centerY + amplitude);
      gradient.addColorStop(0, `${signalColor}${Math.floor(gradientOpacity * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(0.5, `${signalColor}${Math.floor(gradientOpacity * 0.15 * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(1, `${signalColor}${Math.floor(gradientOpacity * 255).toString(16).padStart(2, '0')}`);
      
      ctx.lineTo(rect.width, centerY);
      ctx.lineTo(0, centerY);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      
      const strengthOpacity = pointingInfo?.inBeam ? 0.3 : 0.15;
      ctx.strokeStyle = `rgba(0, 255, 136, ${strengthOpacity})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, centerY - currentSignalStrength * amplitude);
      ctx.lineTo(rect.width, centerY - currentSignalStrength * amplitude);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, centerY + currentSignalStrength * amplitude);
      ctx.lineTo(rect.width, centerY + currentSignalStrength * amplitude);
      ctx.stroke();
    }
    
    const centerLineColor = pointingInfo?.inBeam ? 'rgba(0, 255, 136, 0.5)' :
      pointingInfo?.isObservable ? 'rgba(255, 165, 0, 0.5)' : 'rgba(100, 100, 100, 0.5)';
    ctx.strokeStyle = centerLineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, rect.height / 2);
    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.font = '10px monospace';
    ctx.fillStyle = weather === 'clear' ? 'rgba(0, 212, 255, 0.5)' :
      weather === 'fog' ? 'rgba(255, 150, 50, 0.6)' : 'rgba(100, 150, 255, 0.6)';
    ctx.fillText(`噪声底: ${noiseFloor.toFixed(3)}`, 5, 15);
    
  }, [waveformData, gridLines, currentSignalStrength, weather, noiseFloor, pointingInfo]);
  
  return (
    <GlassPanel
      title="信号波形"
      icon={<Activity size={16} />}
      className={className}
      collapsible
    >
      <div className="flex justify-between items-center mb-2 text-xs font-mono">
        <div className="flex gap-4 items-center">
          <span className="text-slate-400">
            频率: <span className="text-cyan-300">{frequency.toFixed(0)} MHz</span>
          </span>
          <span className="text-slate-400">
            增益: <span className="text-cyan-300">{gain.toFixed(1)} dB</span>
          </span>
          <span className="flex items-center gap-1">
            {weatherIcon}
            <span className="text-slate-400">
              天空亮度: <span className={weather === 'clear' ? 'text-green-400' : weather === 'fog' ? 'text-orange-400' : 'text-blue-400'}>
                {(WEATHER_SKY_BRIGHTNESS[weather] * 100).toFixed(0)}%
              </span>
            </span>
          </span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-400">
            强度: <span className={pointingInfo?.inBeam ? 'text-green-400' : 'text-yellow-400'}>
              {currentSignalStrength.toFixed(3)}
            </span>
          </span>
          <span className="text-slate-400">
            SNR: <span className={currentSNR > 10 ? 'text-green-400' : currentSNR > 0 ? 'text-yellow-400' : 'text-red-400'}>
              {currentSNR.toFixed(1)} dB
            </span>
          </span>
          <span className="text-slate-400">
            噪声底: <span className="text-orange-400">{noiseFloor.toFixed(3)}</span>
          </span>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-32 relative">
        <canvas ref={canvasRef} className="absolute inset-0 rounded" />
      </div>
      <div className="flex justify-between mt-1 text-xs font-mono text-slate-500">
        <span>0 ms</span>
        <span>{((waveformData.length - 1) * 1).toFixed(0)} ms</span>
      </div>
    </GlassPanel>
  );
}
