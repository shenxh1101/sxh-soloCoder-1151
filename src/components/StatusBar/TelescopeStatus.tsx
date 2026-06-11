import { useTelescopeStore } from '@/store/useTelescopeStore';
import { formatRA, formatDec, formatAzimuth, formatAltitude } from '@/utils/astronomy';
import { Radio, Satellite, Target, Cloud, Clock } from 'lucide-react';

export function TelescopeStatus() {
  const azimuth = useTelescopeStore(state => state.azimuth);
  const altitude = useTelescopeStore(state => state.altitude);
  const targetRA = useTelescopeStore(state => state.targetRA);
  const targetDec = useTelescopeStore(state => state.targetDec);
  const trackingStatus = useTelescopeStore(state => state.trackingStatus);
  const isRecording = useTelescopeStore(state => state.isRecording);
  const weather = useTelescopeStore(state => state.weather);
  const frequency = useTelescopeStore(state => state.frequency);
  const gain = useTelescopeStore(state => state.gain);
  const currentSNR = useTelescopeStore(state => state.currentSNR);
  const observationQuality = useTelescopeStore(state => state.observationQuality);
  
  const statusConfig = {
    idle: { color: 'text-slate-400', bg: 'bg-slate-500', label: '待机' },
    moving: { color: 'text-yellow-400', bg: 'bg-yellow-500', label: '移动中' },
    tracking: { color: 'text-green-400', bg: 'bg-green-500', label: '跟踪中' },
    drifting: { color: 'text-cyan-400', bg: 'bg-cyan-500', label: '漂移扫描' },
  };
  
  const weatherLabel = {
    clear: '晴天',
    fog: '雾天',
    rain: '雨天',
  };
  
  const weatherIcon = {
    clear: '☀️',
    fog: '🌫️',
    rain: '🌧️',
  };
  
  const status = statusConfig[trackingStatus];
  
  return (
    <div className="fixed top-0 left-0 right-0 z-40">
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-cyan-500/30">
        <div className="max-w-full mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400" />
                <span className="text-cyan-300 font-bold font-mono tracking-wider">
                  FAST 射电望远镜模拟器
                </span>
              </div>
              
              <div className="h-6 w-px bg-cyan-500/30" />
              
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status.bg} ${trackingStatus !== 'idle' ? 'animate-pulse' : ''}`} />
                <span className={`text-sm font-mono ${status.color}`}>{status.label}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Satellite className="w-4 h-4 text-cyan-500" />
                <div className="flex gap-3">
                  <span className="text-slate-400">
                    Az: <span className="text-cyan-300">{formatAzimuth(azimuth)}</span>
                  </span>
                  <span className="text-slate-400">
                    Alt: <span className="text-cyan-300">{formatAltitude(altitude)}</span>
                  </span>
                </div>
              </div>
              
              <div className="h-4 w-px bg-cyan-500/20" />
              
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-500" />
                <div className="flex gap-3">
                  <span className="text-slate-400">
                    RA: <span className="text-green-300">{formatRA(targetRA)}</span>
                  </span>
                  <span className="text-slate-400">
                    Dec: <span className="text-green-300">{formatDec(targetDec)}</span>
                  </span>
                </div>
              </div>
              
              <div className="h-4 w-px bg-cyan-500/20" />
              
              <div className="flex items-center gap-3">
                <span className="text-slate-400">
                  频率: <span className="text-cyan-300">{frequency.toFixed(0)} MHz</span>
                </span>
                <span className="text-slate-400">
                  增益: <span className="text-cyan-300">{gain.toFixed(1)} dB</span>
                </span>
              </div>
              
              <div className="h-4 w-px bg-cyan-500/20" />
              
              <div className="flex items-center gap-2">
                <span className="text-slate-400">
                  SNR: <span className={currentSNR > 10 ? 'text-green-400' : currentSNR > 0 ? 'text-yellow-400' : 'text-red-400'}>
                    {currentSNR.toFixed(1)} dB
                  </span>
                </span>
              </div>
              
              <div className="h-4 w-px bg-cyan-500/20" />
              
              <div className="flex items-center gap-2">
                <span className="text-slate-400">
                  质量: <span className={observationQuality > 70 ? 'text-green-400' : observationQuality > 40 ? 'text-yellow-400' : 'text-red-400'}>
                    {observationQuality}%
                  </span>
                </span>
              </div>
              
              <div className="h-4 w-px bg-cyan-500/20" />
              
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300">{weatherIcon[weather]} {weatherLabel[weather]}</span>
              </div>
              
              {isRecording && (
                <>
                  <div className="h-4 w-px bg-red-500/30" />
                  <div className="flex items-center gap-2 text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span>记录中</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
