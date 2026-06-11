import { useState } from 'react';
import { MainScene } from '@/components/Scene/MainScene';
import { TelescopeStatus } from '@/components/StatusBar/TelescopeStatus';
import { PointingControl } from '@/components/ControlPanel/PointingControl';
import { SignalControl } from '@/components/ControlPanel/SignalControl';
import { WeatherControl } from '@/components/ControlPanel/WeatherControl';
import { Waveform } from '@/components/Visualization/Waveform';
import { Waterfall } from '@/components/Visualization/Waterfall';
import { QualityIndicator } from '@/components/Scene/Weather';
import { HelpCircle, Maximize2, RotateCcw } from 'lucide-react';
import { GlowButton } from '@/components/UI/GlowButton';
import { useTelescopeStore } from '@/store/useTelescopeStore';

export default function Home() {
  const [showHelp, setShowHelp] = useState(false);
  const resetView = useTelescopeStore(state => state.resetView);
  
  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0e1a]">
      <TelescopeStatus />
      
      <MainScene className="absolute inset-0 pt-12" />
      
      <div className="absolute top-16 right-4 w-80 space-y-4 z-20 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
        <PointingControl />
        <SignalControl />
        <WeatherControl />
      </div>
      
      <div className="absolute bottom-4 left-4 right-[calc(20rem+2rem)] z-20">
        <Waveform />
      </div>
      
      <div className="absolute bottom-4 right-4 w-80 z-20">
        <Waterfall />
      </div>
      
      <QualityIndicator />
      
      <div className="absolute top-16 left-4 z-30 flex gap-2">
        <GlowButton
          onClick={resetView}
          size="sm"
          variant="secondary"
          icon={<RotateCcw size={14} />}
        >
          重置
        </GlowButton>
        <GlowButton
          onClick={() => {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
              elem.requestFullscreen();
            }
          }}
          size="sm"
          variant="secondary"
          icon={<Maximize2 size={14} />}
        >
          全屏
        </GlowButton>
        <GlowButton
          onClick={() => setShowHelp(!showHelp)}
          size="sm"
          variant="secondary"
          icon={<HelpCircle size={14} />}
          active={showHelp}
        >
          帮助
        </GlowButton>
      </div>
      
      {showHelp && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900/95 border border-cyan-500/30 rounded-lg p-6 max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-cyan-300 font-display mb-4">
              FAST 射电望远镜模拟器
            </h2>
            
            <div className="space-y-4 text-sm text-slate-300 font-mono">
              <div>
                <h3 className="text-cyan-400 font-bold mb-2">📡 功能介绍</h3>
                <p className="text-slate-400">
                  本模拟器模拟 500 米口径球面射电望远镜（FAST，中国天眼）的观测过程。
                  位于中国贵州省的喀斯特洼地中，是目前世界上最大的单口径射电望远镜。
                </p>
              </div>
              
              <div>
                <h3 className="text-cyan-400 font-bold mb-2">🎯 目标选择</h3>
                <ul className="text-slate-400 space-y-1 list-disc list-inside">
                  <li>点击 3D 场景中的星星自动指向</li>
                  <li>在右侧面板输入方位角/高度角</li>
                  <li>输入赤经/赤纬坐标</li>
                  <li>从快速选星列表中选择</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-cyan-400 font-bold mb-2">📶 信号控制</h3>
                <ul className="text-slate-400 space-y-1 list-disc list-inside">
                  <li>调节观测频率（100 MHz - 3 GHz）</li>
                  <li>调节接收增益（0 - 60 dB）</li>
                  <li>切换正弦波/脉冲信号模式</li>
                  <li>开启漂移扫描模式</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-cyan-400 font-bold mb-2">🌤️ 天气系统</h3>
                <ul className="text-slate-400 space-y-1 list-disc list-inside">
                  <li>晴天：信号衰减小，观测质量高</li>
                  <li>雾天：中等衰减，信噪比降低</li>
                  <li>雨天：严重衰减，观测困难</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-cyan-400 font-bold mb-2">💾 数据导出</h3>
                <p className="text-slate-400">
                  点击"开始记录"开始采集数据，完成后点击"导出"保存为 CSV 文件，
                  包含时间戳、坐标、信号强度、信噪比等信息。
                </p>
              </div>
              
              <div>
                <h3 className="text-cyan-400 font-bold mb-2">⌨️ 操作提示</h3>
                <ul className="text-slate-400 space-y-1 list-disc list-inside">
                  <li>鼠标左键拖拽：旋转视角</li>
                  <li>鼠标滚轮：缩放</li>
                  <li>点击星星：自动指向目标</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <GlowButton
                onClick={() => setShowHelp(false)}
                variant="primary"
              >
                我知道了
              </GlowButton>
            </div>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-xs text-slate-500 font-mono">
        <span className="opacity-50">
          500 米口径球面射电望远镜 (FAST) 观测模拟器
        </span>
      </div>
    </div>
  );
}
