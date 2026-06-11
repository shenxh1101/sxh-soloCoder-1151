import { useRef, useEffect, useMemo } from 'react';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import { SPECTRUM_BIN_COUNT } from '@/data/config';
import { valueToRGB } from '@/utils/signal';
import { GlassPanel } from '@/components/UI/GlassPanel';
import { BarChart3 } from 'lucide-react';

interface WaterfallProps {
  className?: string;
}

export function Waterfall({ className }: WaterfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const spectrumHistory = useTelescopeStore(state => state.spectrumHistory);
  const frequency = useTelescopeStore(state => state.frequency);
  const isRecording = useTelescopeStore(state => state.isRecording);
  const driftScanMode = useTelescopeStore(state => state.driftScanMode);
  
  const frequencyRange = useMemo(() => {
    const bandwidth = 10;
    return {
      min: frequency - bandwidth / 2,
      max: frequency + bandwidth / 2,
      center: frequency,
    };
  }, [frequency]);
  
  const freqLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= 5; i++) {
      labels.push(frequencyRange.min + (frequencyRange.max - frequencyRange.min) * (i / 5));
    }
    return labels;
  }, [frequencyRange]);
  
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
    
    if (spectrumHistory.length === 0) return;
    
    const historyLength = spectrumHistory.length;
    const binCount = spectrumHistory[0].length;
    
    const cellWidth = rect.width / binCount;
    const cellHeight = rect.height / historyLength;
    
    let maxVal = 0;
    let minVal = Infinity;
    spectrumHistory.forEach(row => {
      row.forEach(val => {
        maxVal = Math.max(maxVal, val);
        minVal = Math.min(minVal, val);
      });
    });
    
    if (maxVal === minVal) {
      maxVal = minVal + 0.001;
    }
    
    const imageData = ctx.createImageData(rect.width, rect.height);
    const data = imageData.data;
    
    for (let row = 0; row < historyLength; row++) {
      const spectrum = spectrumHistory[row];
      for (let col = 0; col < binCount; col++) {
        const value = spectrum[col] || 0;
        const [r, g, b] = valueToRGB(value, minVal, maxVal);
        
        const startX = Math.floor(col * cellWidth);
        const endX = Math.floor((col + 1) * cellWidth);
        const startY = Math.floor(row * cellHeight);
        const endY = Math.floor((row + 1) * cellHeight);
        
        for (let y = startY; y < endY && y < rect.height; y++) {
          for (let x = startX; x < endX && x < rect.width; x++) {
            const idx = (y * rect.width + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    const centerX = rect.width / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, rect.height);
    ctx.stroke();
    
    if (driftScanMode) {
      const scanX = rect.width * 0.3 + (Date.now() % 5000) / 5000 * rect.width * 0.4;
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, rect.height);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
    
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) {
      const x = (rect.width / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    
    for (let i = 1; i < 4; i++) {
      const y = (rect.height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }
    
  }, [spectrumHistory, frequencyRange, driftScanMode]);
  
  return (
    <GlassPanel
      title="瀑布图 (频谱)"
      icon={<BarChart3 size={16} />}
      className={className}
      collapsible
      defaultCollapsed
    >
      <div className="flex justify-between items-center mb-2 text-xs font-mono">
        <div className="flex gap-4">
          <span className="text-slate-400">
            带宽: <span className="text-cyan-300">10 MHz</span>
          </span>
          <span className="text-slate-400">
            分辨率: <span className="text-cyan-300">{(10 / SPECTRUM_BIN_COUNT).toFixed(2)} MHz/bin</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              记录中
            </span>
          )}
          {driftScanMode && (
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              漂移扫描
            </span>
          )}
        </div>
      </div>
      
      <div ref={containerRef} className="w-full h-40 relative">
        <canvas ref={canvasRef} className="absolute inset-0 rounded" />
      </div>
      
      <div className="flex justify-between mt-1 text-xs font-mono text-slate-500">
        {freqLabels.map((f, i) => (
          <span key={i}>{f.toFixed(1)}</span>
        ))}
      </div>
      
      <div className="flex justify-between items-center mt-2">
        <div className="text-xs font-mono text-slate-500">
          时间轴: 最新 ↑  历史 ↓
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-500">低</span>
          <div className="w-20 h-3 rounded"
            style={{
              background: 'linear-gradient(to right, hsl(240, 80%, 20%), hsl(180, 90%, 50%), hsl(0, 90%, 60%))'
            }}
          />
          <span className="text-slate-500">高</span>
        </div>
      </div>
    </GlassPanel>
  );
}
