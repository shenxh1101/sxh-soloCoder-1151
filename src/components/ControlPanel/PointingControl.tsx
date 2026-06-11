import { useState } from 'react';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import { formatRA, formatDec, formatAzimuth, formatAltitude } from '@/utils/astronomy';
import { GlassPanel } from '@/components/UI/GlassPanel';
import { GlowButton } from '@/components/UI/GlowButton';
import { Crosshair, Navigation, RotateCcw, Target } from 'lucide-react';
import { ALL_STARS } from '@/data/stars';

export function PointingControl() {
  const [azInput, setAzInput] = useState('180');
  const [altInput, setAltInput] = useState('45');
  const [raInput, setRaInput] = useState('12.0');
  const [decInput, setDecInput] = useState('0.0');
  const [starFilter, setStarFilter] = useState('');
  
  const azimuth = useTelescopeStore(state => state.azimuth);
  const altitude = useTelescopeStore(state => state.altitude);
  const targetRA = useTelescopeStore(state => state.targetRA);
  const targetDec = useTelescopeStore(state => state.targetDec);
  const selectedStarId = useTelescopeStore(state => state.selectedStarId);
  const trackingStatus = useTelescopeStore(state => state.trackingStatus);
  
  const setPointing = useTelescopeStore(state => state.setPointing);
  const setTargetByRADec = useTelescopeStore(state => state.setTargetByRADec);
  const setTargetByStar = useTelescopeStore(state => state.setTargetByStar);
  const resetView = useTelescopeStore(state => state.resetView);
  
  const filteredStars = ALL_STARS.filter(star => 
    star.name.toLowerCase().includes(starFilter.toLowerCase())
  );
  
  const handleSetAzAlt = () => {
    const az = parseFloat(azInput);
    const alt = parseFloat(altInput);
    if (!isNaN(az) && !isNaN(alt)) {
      setPointing(az, alt);
    }
  };
  
  const handleSetRADec = () => {
    const ra = parseFloat(raInput);
    const dec = parseFloat(decInput);
    if (!isNaN(ra) && !isNaN(dec)) {
      setTargetByRADec(ra, dec);
    }
  };
  
  const trackingStatusText = {
    idle: '待机',
    moving: '移动中',
    tracking: '跟踪中',
    drifting: '漂移扫描',
  };
  
  const trackingStatusColor = {
    idle: 'text-slate-400',
    moving: 'text-yellow-400',
    tracking: 'text-green-400',
    drifting: 'text-cyan-400',
  };
  
  const selectedStar = ALL_STARS.find(s => s.id === selectedStarId);
  
  return (
    <GlassPanel
      title="指向控制"
      icon={<Crosshair size={16} />}
      collapsible
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-slate-500 mb-1">当前方位角 (Az)</div>
            <div className="text-cyan-300 text-sm">{formatAzimuth(azimuth)}</div>
          </div>
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-slate-500 mb-1">当前高度角 (Alt)</div>
            <div className="text-cyan-300 text-sm">{formatAltitude(altitude)}</div>
          </div>
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-slate-500 mb-1">目标赤经 (RA)</div>
            <div className="text-cyan-300 text-sm">{formatRA(targetRA)}</div>
          </div>
          <div className="bg-slate-800/50 rounded p-2">
            <div className="text-slate-500 mb-1">目标赤纬 (Dec)</div>
            <div className="text-cyan-300 text-sm">{formatDec(targetDec)}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs font-mono">状态:</span>
          <span className={`text-sm font-mono ${trackingStatusColor[trackingStatus]}`}>
            {trackingStatusText[trackingStatus]}
          </span>
          {trackingStatus === 'moving' && (
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          )}
          {trackingStatus === 'tracking' && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
        
        {selectedStar && (
          <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
            <div className="text-xs text-green-400 font-mono flex items-center gap-1">
              <Target size={12} />
              已选中: {selectedStar.name}
            </div>
          </div>
        )}
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="text-xs text-slate-400 font-mono mb-2">地平坐标输入</div>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 font-mono">方位角 (0-360°)</label>
              <input
                type="number"
                value={azInput}
                onChange={(e) => setAzInput(e.target.value)}
                className="w-full bg-slate-800 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300 font-mono text-sm focus:outline-none focus:border-cyan-500"
                min="0"
                max="360"
                step="0.1"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 font-mono">高度角 (10-80°)</label>
              <input
                type="number"
                value={altInput}
                onChange={(e) => setAltInput(e.target.value)}
                className="w-full bg-slate-800 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300 font-mono text-sm focus:outline-none focus:border-cyan-500"
                min="10"
                max="80"
                step="0.1"
              />
            </div>
          </div>
          <GlowButton
            onClick={handleSetAzAlt}
            size="sm"
            className="w-full"
            icon={<Navigation size={14} />}
          >
            指向目标
          </GlowButton>
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="text-xs text-slate-400 font-mono mb-2">赤道坐标输入</div>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 font-mono">赤经 (0-24h)</label>
              <input
                type="number"
                value={raInput}
                onChange={(e) => setRaInput(e.target.value)}
                className="w-full bg-slate-800 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300 font-mono text-sm focus:outline-none focus:border-cyan-500"
                min="0"
                max="24"
                step="0.01"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 font-mono">赤纬 (-90-90°)</label>
              <input
                type="number"
                value={decInput}
                onChange={(e) => setDecInput(e.target.value)}
                className="w-full bg-slate-800 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300 font-mono text-sm focus:outline-none focus:border-cyan-500"
                min="-90"
                max="90"
                step="0.01"
              />
            </div>
          </div>
          <GlowButton
            onClick={handleSetRADec}
            size="sm"
            variant="secondary"
            className="w-full"
            icon={<Target size={14} />}
          >
            按赤经赤纬指向
          </GlowButton>
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="text-xs text-slate-400 font-mono mb-2">快速选星</div>
          <input
            type="text"
            placeholder="搜索星星..."
            value={starFilter}
            onChange={(e) => setStarFilter(e.target.value)}
            className="w-full bg-slate-800 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300 font-mono text-sm focus:outline-none focus:border-cyan-500 mb-2"
          />
          <div className="max-h-32 overflow-y-auto space-y-1">
            {filteredStars.map((star) => (
              <button
                key={star.id}
                onClick={() => setTargetByStar(star)}
                className={`w-full text-left px-2 py-1 rounded text-xs font-mono transition-colors ${
                  selectedStarId === star.id
                    ? 'bg-green-500/20 text-green-400'
                    : 'hover:bg-cyan-500/10 text-slate-300'
                }`}
              >
                <span className="flex justify-between items-center">
                  <span>{star.name}</span>
                  {star.isPulsar && <span className="text-green-500">★</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <GlowButton
            onClick={resetView}
            size="sm"
            variant="secondary"
            className="w-full"
            icon={<RotateCcw size={14} />}
          >
            重置视角
          </GlowButton>
        </div>
      </div>
    </GlassPanel>
  );
}
