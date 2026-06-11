import { useRef, useEffect, useMemo } from 'react';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import { COLORS } from '@/data/config';
import { GlassPanel } from '@/components/UI/GlassPanel';
import { Activity } from 'lucide-react';

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
  
  const gridLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i <= 4; i++) {
      lines.push(i / 4);
    }
    return lines;
  }, []);
  
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
    
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
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
    
    if (waveformData.length > 0) {
      const centerY = rect.height / 2;
      const amplitude = rect.height * 0.4;
      
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      
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
      
      ctx.strokeStyle = COLORS.signal;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = COLORS.signal;
      ctx.shadowBlur = 8;
      ctx.stroke();
      
      ctx.shadowBlur = 0;
      
      const gradient = ctx.createLinearGradient(0, centerY - amplitude, 0, centerY + amplitude);
      gradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
      gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.05)');
      gradient.addColorStop(1, 'rgba(0, 212, 255, 0.3)');
      
      ctx.lineTo(rect.width, centerY);
      ctx.lineTo(0, centerY);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
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
    
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, rect.height / 2);
    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
  }, [waveformData, gridLines, currentSignalStrength]);
  
  return (
    <GlassPanel
      title="信号波形"
      icon={<Activity size={16} />}
      className={className}
      collapsible
    >
      <div className="flex justify-between items-center mb-2 text-xs font-mono">
        <div className="flex gap-4">
          <span className="text-slate-400">
            频率: <span className="text-cyan-300">{frequency.toFixed(0)} MHz</span>
          </span>
          <span className="text-slate-400">
            增益: <span className="text-cyan-300">{gain.toFixed(1)} dB</span>
          </span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-400">
            强度: <span className="text-green-400">{currentSignalStrength.toFixed(3)}</span>
          </span>
          <span className="text-slate-400">
            SNR: <span className={currentSNR > 10 ? 'text-green-400' : currentSNR > 0 ? 'text-yellow-400' : 'text-red-400'}>
              {currentSNR.toFixed(1)} dB
            </span>
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
