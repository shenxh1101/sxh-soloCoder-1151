import { useTelescopeStore } from '@/store/useTelescopeStore';
import { GlassPanel } from '@/components/UI/GlassPanel';
import { GlowButton } from '@/components/UI/GlowButton';
import { Radio, Play, Square, Download, Waves, Activity } from 'lucide-react';
import type { SignalMode } from '@/types';

export function SignalControl() {
  const frequency = useTelescopeStore(state => state.frequency);
  const gain = useTelescopeStore(state => state.gain);
  const signalMode = useTelescopeStore(state => state.signalMode);
  const isRecording = useTelescopeStore(state => state.isRecording);
  const recordedData = useTelescopeStore(state => state.recordedData);
  const driftScanMode = useTelescopeStore(state => state.driftScanMode);
  const currentSignalStrength = useTelescopeStore(state => state.currentSignalStrength);
  const currentSNR = useTelescopeStore(state => state.currentSNR);
  
  const setSignalParams = useTelescopeStore(state => state.setSignalParams);
  const setSignalMode = useTelescopeStore(state => state.setSignalMode);
  const toggleRecording = useTelescopeStore(state => state.toggleRecording);
  const toggleDriftScan = useTelescopeStore(state => state.toggleDriftScan);
  const exportCSV = useTelescopeStore(state => state.exportCSV);
  
  return (
    <GlassPanel
      title="信号控制"
      icon={<Radio size={16} />}
      collapsible
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-slate-500 mb-1">信号强度</div>
            <div className={`text-sm ${currentSignalStrength > 0.5 ? 'text-green-400' : currentSignalStrength > 0.2 ? 'text-yellow-400' : 'text-red-400'}`}>
              {(currentSignalStrength * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-slate-500 mb-1">信噪比</div>
            <div className={`text-sm ${currentSNR > 10 ? 'text-green-400' : currentSNR > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {currentSNR.toFixed(1)} dB
            </div>
          </div>
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-slate-400 font-mono">观测频率</label>
            <span className="text-cyan-300 font-mono text-sm">{frequency.toFixed(0)} MHz</span>
          </div>
          <input
            type="range"
            min="100"
            max="3000"
            step="10"
            value={frequency}
            onChange={(e) => setSignalParams(parseInt(e.target.value), gain)}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-slate-500 font-mono mt-1">
            <span>100 MHz</span>
            <span>1420 MHz</span>
            <span>3 GHz</span>
          </div>
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-slate-400 font-mono">增益</label>
            <span className="text-cyan-300 font-mono text-sm">{gain.toFixed(1)} dB</span>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            step="1"
            value={gain}
            onChange={(e) => setSignalParams(frequency, parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-slate-500 font-mono mt-1">
            <span>0 dB</span>
            <span>30 dB</span>
            <span>60 dB</span>
          </div>
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="text-xs text-slate-400 font-mono mb-2">信号模式</div>
          <div className="flex gap-2">
            <GlowButton
              onClick={() => setSignalMode('sine')}
              size="sm"
              variant={signalMode === 'sine' ? 'primary' : 'secondary'}
              active={signalMode === 'sine'}
              icon={<Waves size={14} />}
              className="flex-1"
            >
              正弦波
            </GlowButton>
            <GlowButton
              onClick={() => setSignalMode('pulse')}
              size="sm"
              variant={signalMode === 'pulse' ? 'primary' : 'secondary'}
              active={signalMode === 'pulse'}
              icon={<Activity size={14} />}
              className="flex-1"
            >
              脉冲
            </GlowButton>
          </div>
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="text-xs text-slate-400 font-mono mb-2">观测模式</div>
          <GlowButton
            onClick={toggleDriftScan}
            size="sm"
            variant={driftScanMode ? 'warning' : 'secondary'}
            active={driftScanMode}
            className="w-full"
          >
            {driftScanMode ? '● 漂移扫描中' : '○ 开启漂移扫描'}
          </GlowButton>
          <p className="text-xs text-slate-500 mt-1">
            漂移扫描模式下望远镜固定指向，地球自转将带动目标扫过波束
          </p>
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="flex gap-2">
            <GlowButton
              onClick={toggleRecording}
              size="sm"
              variant={isRecording ? 'danger' : 'success'}
              active={isRecording}
              icon={isRecording ? <Square size={14} /> : <Play size={14} />}
              className="flex-1"
            >
              {isRecording ? '停止记录' : '开始记录'}
            </GlowButton>
            <GlowButton
              onClick={exportCSV}
              size="sm"
              variant="secondary"
              icon={<Download size={14} />}
              disabled={recordedData.length === 0}
            >
              导出
            </GlowButton>
          </div>
          {isRecording && (
            <div className="mt-2 text-xs font-mono text-red-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              已记录 {recordedData.length} 个样本
            </div>
          )}
          {!isRecording && recordedData.length > 0 && (
            <div className="mt-2 text-xs font-mono text-slate-400">
              缓冲区: {recordedData.length} 个样本
            </div>
          )}
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="text-xs text-slate-400 font-mono mb-2">常用频率</div>
          <div className="flex flex-wrap gap-1">
            {[408, 1420, 1667, 2380, 3000].map(freq => (
              <button
                key={freq}
                onClick={() => setSignalParams(freq, gain)}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  frequency === freq
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-cyan-500/10'
                }`}
              >
                {freq} MHz
              </button>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
