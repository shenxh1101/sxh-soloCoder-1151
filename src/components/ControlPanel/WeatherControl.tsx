import { useTelescopeStore } from '@/store/useTelescopeStore';
import { GlassPanel } from '@/components/UI/GlassPanel';
import { GlowButton } from '@/components/UI/GlowButton';
import { Cloud, CloudRain, Sun, CloudFog } from 'lucide-react';
import type { WeatherType } from '@/types';

const WEATHER_OPTIONS: { type: WeatherType; label: string; icon: typeof Sun; attenuation: string }[] = [
  { type: 'clear', label: '晴天', icon: Sun, attenuation: '0.5 dB' },
  { type: 'fog', label: '雾天', icon: CloudFog, attenuation: '2-5 dB' },
  { type: 'rain', label: '雨天', icon: CloudRain, attenuation: '5-15 dB' },
];

export function WeatherControl() {
  const weather = useTelescopeStore(state => state.weather);
  const observationQuality = useTelescopeStore(state => state.observationQuality);
  const setWeather = useTelescopeStore(state => state.setWeather);
  
  let qualityColor = '#00ff88';
  let qualityLabel = '优秀';
  
  if (observationQuality < 40) {
    qualityColor = '#ff4444';
    qualityLabel = '较差';
  } else if (observationQuality < 70) {
    qualityColor = '#ffaa00';
    qualityLabel = '一般';
  }
  
  return (
    <GlassPanel
      title="天气控制"
      icon={<Cloud size={16} />}
      collapsible
    >
      <div className="space-y-4">
        <div className="bg-slate-800/50 rounded p-3">
          <div className="text-xs text-slate-400 font-mono mb-2">观测质量评分</div>
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="4"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke={qualityColor}
                  strokeWidth="4"
                  strokeDasharray={`${observationQuality * 1.76} 176`}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 6px ${qualityColor})` }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-mono font-bold" style={{ color: qualityColor }}>
                  {observationQuality}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm font-mono" style={{ color: qualityColor }}>
                {qualityLabel}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                满分 100
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="text-xs text-slate-400 font-mono mb-2">选择天气</div>
          <div className="space-y-2">
            {WEATHER_OPTIONS.map((option) => (
              <GlowButton
                key={option.type}
                onClick={() => setWeather(option.type)}
                size="sm"
                variant={weather === option.type ? 'primary' : 'secondary'}
                active={weather === option.type}
                icon={<option.icon size={16} />}
                className="w-full justify-between"
              >
                <span>{option.label}</span>
                <span className="text-xs text-slate-400">衰减 {option.attenuation}</span>
              </GlowButton>
            ))}
          </div>
        </div>
        
        <div className="border-t border-cyan-500/20 pt-3">
          <div className="text-xs text-slate-400 font-mono mb-2">天气影响说明</div>
          <div className="space-y-1 text-xs text-slate-500 font-mono">
            <div className="flex justify-between">
              <span className="text-yellow-500">●</span>
              <span>信号衰减</span>
              <span className="text-slate-400">降低信噪比</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-500">●</span>
              <span>噪声增加</span>
              <span className="text-slate-400">提高背景噪声</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-500">●</span>
              <span>能见度</span>
              <span className="text-slate-400">影响观测距离</span>
            </div>
          </div>
        </div>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
          <div className="text-xs text-yellow-400 font-mono">
            💡 提示: 选择不同天气观察其对观测质量和信号强度的影响
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
