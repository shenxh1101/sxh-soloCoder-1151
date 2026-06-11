import { useRef, useEffect, useMemo, useState } from 'react';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import { SPECTRUM_BIN_COUNT, SPECTRUM_HISTORY_LENGTH } from '@/data/config';
import { valueToRGB, findPeakFrequency } from '@/utils/signal';
import { GlassPanel } from '@/components/UI/GlassPanel';
import { GlowButton } from '@/components/UI/GlowButton';
import { BarChart3, Pause, Play, Trash2, Download, Target } from 'lucide-react';

interface WaterfallProps {
  className?: string;
}

export function Waterfall({ className }: WaterfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBin, setHoveredBin] = useState<number | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  
  const spectrumHistory = useTelescopeStore(state => state.spectrumHistory);
  const frequency = useTelescopeStore(state => state.frequency);
  const isRecording = useTelescopeStore(state => state.isRecording);
  const driftScanMode = useTelescopeStore(state => state.driftScanMode);
  const waterfallPaused = useTelescopeStore(state => state.waterfallPaused);
  const waterfallStartTime = useTelescopeStore(state => state.waterfallStartTime);
  const pointingInfo = useTelescopeStore(state => state.pointingInfo);
  const trackingStatus = useTelescopeStore(state => state.trackingStatus);
  
  const toggleWaterfallPause = useTelescopeStore(state => state.toggleWaterfallPause);
  const clearWaterfall = useTelescopeStore(state => state.clearWaterfall);
  const exportSpectrumData = useTelescopeStore(state => state.exportSpectrumData);
  
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
  
  const timeRange = useMemo(() => {
    const timeStep = 0.05;
    return {
      total: SPECTRUM_HISTORY_LENGTH * timeStep,
      step: timeStep,
    };
  }, []);
  
  const peakInfo = useMemo(() => {
    if (spectrumHistory.length === 0 || !spectrumHistory[0]) return null;
    return findPeakFrequency(spectrumHistory[0], frequencyRange.min, frequencyRange.max);
  }, [spectrumHistory, frequencyRange]);
  
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
    
    const weather = useTelescopeStore.getState().weather;
    
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
        const [r, g, b] = valueToRGB(value, minVal, maxVal, weather);
        
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
    
    if (peakInfo && peakInfo.amplitude > minVal + (maxVal - minVal) * 0.1) {
      const peakX = ((peakInfo.frequency - frequencyRange.min) / (frequencyRange.max - frequencyRange.min)) * rect.width;
      ctx.strokeStyle = 'rgba(255, 170, 0, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(peakX, 0);
      ctx.lineTo(peakX, rect.height);
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(255, 170, 0, 0.9)';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText(`↑ ${peakInfo.frequency.toFixed(2)} MHz`, peakX + 3, 12);
    }
    
    if (driftScanMode) {
      const targetBin = Math.floor(((frequency - frequencyRange.min) / (frequencyRange.max - frequencyRange.min)) * binCount);
      const scanX = (targetBin / binCount) * rect.width;
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
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
    
    if (hoveredBin !== null && hoveredTime !== null) {
      const hoverX = (hoveredBin / binCount) * rect.width;
      const hoverY = (hoveredTime / SPECTRUM_HISTORY_LENGTH) * rect.height;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, rect.height);
      ctx.moveTo(0, hoverY);
      ctx.lineTo(rect.width, hoverY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
  }, [spectrumHistory, frequencyRange, driftScanMode, peakInfo, hoveredBin, hoveredTime]);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const binCount = spectrumHistory[0]?.length || SPECTRUM_BIN_COUNT;
    const bin = Math.floor((x / rect.width) * binCount);
    const timeIdx = Math.floor((y / rect.height) * SPECTRUM_HISTORY_LENGTH);
    
    setHoveredBin(bin);
    setHoveredTime(timeIdx);
  };
  
  const handleMouseLeave = () => {
    setHoveredBin(null);
    setHoveredTime(null);
  };
  
  const getStatusColor = () => {
    if (!pointingInfo.isObservable) return 'text-red-400';
    if (trackingStatus === 'slewing') return 'text-yellow-400';
    if (pointingInfo.inBeam) return 'text-green-400';
    return 'text-yellow-400';
  };
  
  return (
    <GlassPanel
      title="瀑布图 (频谱)"
      icon={<BarChart3 size={16} />}
      className={className}
      collapsible
      defaultCollapsed
    >
      <div className="flex justify-between items-center mb-2 text-xs font-mono">
        <div className="flex gap-4 items-center">
          <span className="text-slate-400">
            带宽: <span className="text-cyan-300">10 MHz</span>
          </span>
          <span className="text-slate-400">
            分辨率: <span className="text-cyan-300">{(10 / SPECTRUM_BIN_COUNT).toFixed(2)} MHz/bin</span>
          </span>
          <span className="text-slate-400">
            时间范围: <span className="text-cyan-300">{timeRange.total.toFixed(1)} s</span>
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
          {waterfallPaused && (
            <span className="flex items-center gap-1 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              已暂停
            </span>
          )}
          <span className={`flex items-center gap-1 ${getStatusColor()}`}>
            <Target size={12} />
            {pointingInfo.inBeam ? '波束内' : pointingInfo.isObservable ? '捕获中' : '不可观测'}
          </span>
        </div>
      </div>
      
      <div className="flex gap-2 mb-2">
        <GlowButton
          onClick={toggleWaterfallPause}
          size="xs"
          variant={waterfallPaused ? 'success' : 'secondary'}
          icon={waterfallPaused ? <Play size={12} /> : <Pause size={12} />}
        >
          {waterfallPaused ? '继续' : '暂停'}
        </GlowButton>
        <GlowButton
          onClick={clearWaterfall}
          size="xs"
          variant="warning"
          icon={<Trash2 size={12} />}
        >
          清空
        </GlowButton>
        <GlowButton
          onClick={exportSpectrumData}
          size="xs"
          variant="primary"
          icon={<Download size={12} />}
        >
          导出频谱
        </GlowButton>
      </div>
      
      {peakInfo && (
        <div className="flex gap-4 mb-2 text-xs font-mono">
          <span className="text-slate-400">
            峰值频率: <span className="text-yellow-300">{peakInfo.frequency.toFixed(2)} MHz</span>
          </span>
          <span className="text-slate-400">
            峰值幅度: <span className="text-yellow-300">{peakInfo.amplitude.toExponential(2)}</span>
          </span>
          <span className="text-slate-400">
            指向误差: <span className={pointingInfo.pointingError < 0.1 ? 'text-green-300' : 'text-yellow-300'}>
              {pointingInfo.pointingError.toFixed(3)}°
            </span>
          </span>
        </div>
      )}
      
      <div 
        ref={containerRef} 
        className="w-full h-48 relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 rounded cursor-crosshair" 
        />
        {hoveredBin !== null && hoveredTime !== null && spectrumHistory[hoveredTime] && (
          <div className="absolute top-1 left-1 bg-slate-900/90 border border-cyan-500/50 rounded px-2 py-1 text-xs font-mono pointer-events-none">
            <div>频率: {(frequencyRange.min + (hoveredBin / SPECTRUM_BIN_COUNT) * 10).toFixed(2)} MHz</div>
            <div>时间: -{(timeRange.total - hoveredTime * timeRange.step).toFixed(2)} s</div>
            <div>强度: {spectrumHistory[hoveredTime][hoveredBin]?.toExponential(3) || 'N/A'}</div>
          </div>
        )}
      </div>
      
      <div className="flex justify-between mt-1 text-xs font-mono text-slate-500">
        {freqLabels.map((f, i) => (
          <span key={i}>{f.toFixed(1)}</span>
        ))}
      </div>
      
      <div className="flex justify-between items-center mt-2">
        <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
          <span>时间轴: 最新 ↑  历史 ↓</span>
          <span>
            开始: {new Date(waterfallStartTime).toLocaleTimeString()}
          </span>
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
      
      {!pointingInfo.isObservable && pointingInfo.reason && (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs font-mono text-red-400">
          ⚠️ {pointingInfo.reason}
        </div>
      )}
    </GlassPanel>
  );
}
