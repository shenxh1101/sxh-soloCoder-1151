import { useState, useMemo } from 'react';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import { GlassPanel } from '@/components/UI/GlassPanel';
import { GlowButton } from '@/components/UI/GlowButton';
import { ALL_STARS } from '@/data/stars';
import { formatRA, formatDec } from '@/utils/astronomy';
import { 
  ListTodo, Play, Square, Plus, Trash2, ChevronUp, ChevronDown, 
  CheckCircle, XCircle, Clock, Loader, Target, Radio, 
  FastForward, Rewind, Pause, PlayCircle, StopCircle 
} from 'lucide-react';
import type { StarData, ObservationTask, TaskPhase } from '@/types';

const PHASE_LABELS: Record<TaskPhase, string> = {
  idle: '待机',
  preparing: '准备中',
  calibrating: '校准中',
  observing: '观测中',
  wrapping: '收尾中',
};

const PHASE_COLORS: Record<TaskPhase, string> = {
  idle: 'bg-slate-500',
  preparing: 'bg-blue-500',
  calibrating: 'bg-yellow-500',
  observing: 'bg-green-500',
  wrapping: 'bg-purple-500',
};

const PHASE_TEXT_COLORS: Record<TaskPhase, string> = {
  idle: 'text-slate-400',
  preparing: 'text-blue-400',
  calibrating: 'text-yellow-400',
  observing: 'text-green-400',
  wrapping: 'text-purple-400',
};

export function ObservationQueue() {
  const observationTasks = useTelescopeStore(state => state.observationTasks);
  const currentTaskIndex = useTelescopeStore(state => state.currentTaskIndex);
  const isReplayMode = useTelescopeStore(state => state.isReplayMode);
  const replayTaskId = useTelescopeStore(state => state.replayTaskId);
  const replayTime = useTelescopeStore(state => state.replayTime);
  const replayPaused = useTelescopeStore(state => state.replayPaused);
  
  const addObservationTask = useTelescopeStore(state => state.addObservationTask);
  const removeObservationTask = useTelescopeStore(state => state.removeObservationTask);
  const startObservationQueue = useTelescopeStore(state => state.startObservationQueue);
  const stopObservationQueue = useTelescopeStore(state => state.stopObservationQueue);
  const clearObservationQueue = useTelescopeStore(state => state.clearObservationQueue);
  const moveTaskUp = useTelescopeStore(state => state.moveTaskUp);
  const moveTaskDown = useTelescopeStore(state => state.moveTaskDown);
  const setTargetByStar = useTelescopeStore(state => state.setTargetByStar);
  const setTargetByRADec = useTelescopeStore(state => state.setTargetByRADec);
  const startReplay = useTelescopeStore(state => state.startReplay);
  const stopReplay = useTelescopeStore(state => state.stopReplay);
  const toggleReplayPause = useTelescopeStore(state => state.toggleReplayPause);
  const setReplayTime = useTelescopeStore(state => state.setReplayTime);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState<'star' | 'radec'>('star');
  const [selectedStarId, setSelectedStarId] = useState<string>('');
  const [manualRA, setManualRA] = useState('12.0');
  const [manualDec, setManualDec] = useState('0.0');
  const [taskDuration, setTaskDuration] = useState('30');
  const [autoRecord, setAutoRecord] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  
  const isRunning = useMemo(() => 
    observationTasks.some(t => t.status === 'running'), 
    [observationTasks]
  );
  
  const availableStars = useMemo(() => 
    ALL_STARS.filter(s => !observationTasks.some(t => t.targetStarId === s.id)),
    [ALL_STARS, observationTasks]
  );
  
  const handleAddTask = () => {
    let targetRA = 0;
    let targetDec = 0;
    let targetStarId: string | undefined;
    let name = taskName;
    
    if (taskType === 'star' && selectedStarId) {
      const star = ALL_STARS.find(s => s.id === selectedStarId);
      if (!star) return;
      targetRA = star.ra;
      targetDec = star.dec;
      targetStarId = star.id;
      if (!name) name = star.name;
    } else if (taskType === 'radec') {
      targetRA = parseFloat(manualRA);
      targetDec = parseFloat(manualDec);
      if (isNaN(targetRA) || isNaN(targetDec)) return;
      targetRA = Math.max(0, Math.min(24, targetRA));
      targetDec = Math.max(-90, Math.min(90, targetDec));
      if (!name) name = `RA ${formatRA(targetRA)} Dec ${formatDec(targetDec)}`;
    }
    
    const duration = parseInt(taskDuration);
    if (isNaN(duration) || duration < 5 || duration > 3600) return;
    
    addObservationTask({
      name,
      targetRA,
      targetDec,
      targetStarId,
      duration,
      recordData: autoRecord,
    });
    
    setShowAddForm(false);
    setTaskName('');
    setSelectedStarId('');
    setManualRA('12.0');
    setManualDec('0.0');
  };
  
  const handleGotoTask = async (task: ObservationTask) => {
    if (task.targetStarId) {
      const star = ALL_STARS.find(s => s.id === task.targetStarId);
      if (star) await setTargetByStar(star);
    } else {
      await setTargetByRADec(task.targetRA, task.targetDec);
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="text-slate-400" />;
      case 'running': return <Loader size={14} className="text-cyan-400 animate-spin" />;
      case 'completed': return <CheckCircle size={14} className="text-green-400" />;
      case 'failed': return <XCircle size={14} className="text-red-400" />;
      case 'skipped': return <XCircle size={14} className="text-yellow-400" />;
      default: return null;
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '等待中';
      case 'running': return '执行中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'skipped': return '已跳过';
      default: return status;
    }
  };
  
  const renderPhaseTimeline = (task: ObservationTask) => {
    const phases: TaskPhase[] = ['preparing', 'calibrating', 'observing', 'wrapping'];
    const totalDuration = phases.reduce((sum, p) => sum + task.phaseTiming[p], 0);
    
    return (
      <div className="mt-2 mb-2">
        <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
          <span>任务阶段</span>
          <span>总时长: {totalDuration}s</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-700/50">
          {phases.map((phase) => {
            const phaseDuration = task.phaseTiming[phase];
            const width = (phaseDuration / totalDuration) * 100;
            const isActive = task.status === 'running' && task.currentPhase === phase;
            const isPast = 
              (task.status === 'completed') ||
              (task.status === 'running' && 
               phases.indexOf(task.currentPhase) > phases.indexOf(phase));
            
            return (
              <div
                key={phase}
                className={`h-full transition-all ${
                  isActive ? `${PHASE_COLORS[phase]} animate-pulse` :
                  isPast ? PHASE_COLORS[phase] :
                  'bg-slate-600/30'
                }`}
                style={{ width: `${width}%` }}
                title={`${PHASE_LABELS[phase]}: ${phaseDuration}s`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] font-mono mt-1">
          {phases.map((phase) => (
            <span key={phase} className={task.currentPhase === phase ? PHASE_TEXT_COLORS[phase] : 'text-slate-500'}>
              {PHASE_LABELS[phase]}
            </span>
          ))}
        </div>
      </div>
    );
  };
  
  const renderTimeSeriesCharts = (task: ObservationTask) => {
    if (!task.timeSeriesData || task.timeSeriesData.timestamps.length === 0) {
      return null;
    }
    
    const { timestamps, snr, signalStrength, pointingError, quality } = task.timeSeriesData;
    const length = timestamps.length;
    
    const replayIdx = isReplayMode && replayTaskId === task.id 
      ? Math.floor(replayTime) 
      : -1;
    
    const metrics = [
      { key: 'snr', label: 'SNR', data: snr, unit: 'dB', color: '#00d4ff' },
      { key: 'signalStrength', label: '信号强度', data: signalStrength, unit: '', color: '#00ff88' },
      { key: 'pointingError', label: '指向误差', data: pointingError, unit: '°', color: '#ffaa00' },
      { key: 'quality', label: '观测质量', data: quality, unit: '%', color: '#aa88ff' },
    ];
    
    return (
      <div className="mt-3 pt-2 border-t border-slate-700/30 space-y-3">
        <div className="text-xs font-mono text-slate-400">观测指标时间线</div>
        
        {metrics.map(metric => {
          const data = metric.data;
          if (!data || data.length === 0) return null;
          
          const max = Math.max(...data, 0.001);
          const min = Math.min(...data, 0);
          const range = max - min || 1;
          
          return (
            <div key={metric.key} className="relative h-10 bg-slate-800/30 rounded overflow-hidden">
              <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${length} 100`} preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke={metric.color}
                  strokeWidth="0.8"
                  points={data.map((val, i) => `${i},${100 - ((val - min) / range) * 100}`).join(' ')}
                />
                {replayIdx >= 0 && replayIdx < length && (
                  <line
                    x1={replayIdx}
                    y1="0"
                    x2={replayIdx}
                    y2="100"
                    stroke="#ffffff"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                  />
                )}
              </svg>
              <div className="absolute top-0.5 left-2 text-[9px] font-mono text-slate-500">
                {metric.label}: {max.toFixed(metric.key === 'pointingError' ? 3 : 1)} {metric.unit}
              </div>
              <div className="absolute bottom-0.5 left-2 text-[9px] font-mono text-slate-500">
                {min.toFixed(metric.key === 'pointingError' ? 3 : 1)} {metric.unit}
              </div>
              {replayIdx >= 0 && replayIdx < length && (
                <div 
                  className="absolute top-0.5 right-2 text-[9px] font-mono"
                  style={{ color: metric.color }}
                >
                  当前: {data[replayIdx]?.toFixed(metric.key === 'pointingError' ? 3 : 1)} {metric.unit}
                </div>
              )}
            </div>
          );
        })}
        
        <div className="text-[9px] font-mono text-slate-500 text-right">
          共 {length} 秒数据
        </div>
      </div>
    );
  };
  
  const handleReplaySliderChange = (taskId: string, value: number) => {
    if (replayTaskId === taskId) {
      setReplayTime(value);
    }
  };
  
  const completedCount = observationTasks.filter(t => t.status === 'completed').length;
  const totalDuration = observationTasks.reduce((sum, t) => sum + t.duration, 0);
  
  return (
    <GlassPanel
      title="观测任务队列"
      icon={<ListTodo size={16} />}
      collapsible
    >
      <div className="space-y-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="text-xs font-mono text-slate-400">
            <span>共 {observationTasks.length} 个任务</span>
            <span className="mx-2">|</span>
            <span>已完成 {completedCount}</span>
            <span className="mx-2">|</span>
            <span>预计总时长 {totalDuration}s</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isRunning ? (
              <GlowButton
                onClick={startObservationQueue}
                size="xs"
                variant="success"
                icon={<Play size={12} />}
                disabled={observationTasks.length === 0 || observationTasks.every(t => t.status === 'completed') || isReplayMode}
              >
                开始执行
              </GlowButton>
            ) : (
              <GlowButton
                onClick={stopObservationQueue}
                size="xs"
                variant="danger"
                icon={<Square size={12} />}
              >
                停止
              </GlowButton>
            )}
            <GlowButton
              onClick={() => setShowAddForm(!showAddForm)}
              size="xs"
              variant="primary"
              icon={<Plus size={12} />}
              active={showAddForm}
            >
              {showAddForm ? '取消' : '添加任务'}
            </GlowButton>
            <GlowButton
              onClick={clearObservationQueue}
              size="xs"
              variant="warning"
              icon={<Trash2 size={12} />}
              disabled={observationTasks.length === 0 || isRunning || isReplayMode}
            >
              清空
            </GlowButton>
          </div>
        </div>
        
        {isReplayMode && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded p-2">
            <div className="text-xs text-purple-300 font-mono flex items-center gap-2">
              <PlayCircle size={14} />
              <span>回放模式</span>
              {replayPaused ? <Pause size={12} /> : <Play size={12} />}
              <button
                onClick={stopReplay}
                className="ml-auto text-purple-400 hover:text-purple-300"
                title="退出回放"
              >
                <StopCircle size={14} />
              </button>
            </div>
          </div>
        )}
        
        {showAddForm && (
          <div className="bg-slate-800/50 rounded p-3 space-y-3">
            <div className="text-xs font-mono text-cyan-300 mb-2">添加新观测任务</div>
            
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={taskType === 'star'}
                  onChange={() => setTaskType('star')}
                  className="accent-cyan-500"
                />
                <span className="text-xs font-mono text-slate-300">选择恒星</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={taskType === 'radec'}
                  onChange={() => setTaskType('radec')}
                  className="accent-cyan-500"
                />
                <span className="text-xs font-mono text-slate-300">手动输入坐标</span>
              </label>
            </div>
            
            {taskType === 'star' ? (
              <select
                value={selectedStarId}
                onChange={(e) => setSelectedStarId(e.target.value)}
                className="w-full bg-slate-900 border border-cyan-500/30 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- 请选择目标恒星 --</option>
                {availableStars.map(star => (
                  <option key={star.id} value={star.id}>
                    {star.name} (RA: {formatRA(star.ra)}, Dec: {formatDec(star.dec)}) {star.isPulsar ? '[脉冲星]' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">赤经 RA (0-24h)</label>
                  <input
                    type="number"
                    value={manualRA}
                    onChange={(e) => setManualRA(e.target.value)}
                    min="0"
                    max="24"
                    step="0.01"
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">赤纬 Dec (-90~90°)</label>
                  <input
                    type="number"
                    value={manualDec}
                    onChange={(e) => setManualDec(e.target.value)}
                    min="-90"
                    max="90"
                    step="0.01"
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">任务名称 (可选)</label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="自动生成"
                  className="w-full bg-slate-900 border border-cyan-500/30 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">观测时长 (5-3600s)</label>
                <input
                  type="number"
                  value={taskDuration}
                  onChange={(e) => setTaskDuration(e.target.value)}
                  min="5"
                  max="3600"
                  step="5"
                  className="w-full bg-slate-900 border border-cyan-500/30 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRecord}
                onChange={(e) => setAutoRecord(e.target.checked)}
                className="accent-cyan-500"
              />
              <span className="text-xs font-mono text-slate-300">自动记录数据</span>
            </label>
            
            <div className="flex justify-end gap-2">
              <GlowButton
                onClick={() => setShowAddForm(false)}
                size="xs"
                variant="secondary"
              >
                取消
              </GlowButton>
              <GlowButton
                onClick={handleAddTask}
                size="xs"
                variant="primary"
                disabled={taskType === 'star' ? !selectedStarId : false}
              >
                添加
              </GlowButton>
            </div>
          </div>
        )}
        
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {observationTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 font-mono text-sm">
              暂无观测任务，点击"添加任务"开始
            </div>
          ) : (
            observationTasks.map((task, index) => {
              const isExpanded = expandedTaskId === task.id;
              const isReplayingThis = isReplayMode && replayTaskId === task.id;
              
              return (
                <div
                  key={task.id}
                  className={`p-3 rounded border transition-all ${
                    currentTaskIndex === index && task.status === 'running'
                      ? 'bg-cyan-500/10 border-cyan-500/50'
                      : isReplayingThis
                      ? 'bg-purple-500/10 border-purple-500/50'
                      : task.status === 'completed'
                      ? 'bg-green-500/5 border-green-500/20'
                      : task.status === 'failed'
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(task.status)}
                        <span className="text-sm font-mono text-slate-200 font-medium">
                          {index + 1}. {task.name}
                        </span>
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                          task.status === 'running' ? 'bg-cyan-500/20 text-cyan-300' :
                          task.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                          task.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                          'bg-slate-700/50 text-slate-400'
                        }`}>
                          {getStatusText(task.status)}
                        </span>
                        {task.status === 'running' && (
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${PHASE_COLORS[task.currentPhase]}/20 ${PHASE_TEXT_COLORS[task.currentPhase]}`}>
                            {PHASE_LABELS[task.currentPhase]}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs font-mono text-slate-400 space-y-0.5">
                        <div>
                          RA: {formatRA(task.targetRA)} | Dec: {formatDec(task.targetDec)}
                        </div>
                        <div className="flex gap-4">
                          <span>观测: {task.duration}s</span>
                          <span>记录: {task.recordData ? '是' : '否'}</span>
                        </div>
                        
                        {task.status === 'running' && renderPhaseTimeline(task)}
                        
                        {task.status === 'running' && task.currentPhase === 'observing' && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs font-mono text-green-400 mb-1">
                              <span>📡 观测进度</span>
                              <span>{task.observationProgress.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-100"
                                style={{ width: `${task.observationProgress}%` }}
                              />
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 mt-1 text-right">
                              已观测 {Math.floor(task.observationProgress / 100 * task.duration)}s / {task.duration}s
                            </div>
                          </div>
                        )}
                        
                        {task.status === 'running' && task.currentPhase !== 'observing' && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                              <span>{PHASE_LABELS[task.currentPhase]}...</span>
                              <span>{task.phaseProgress.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${PHASE_COLORS[task.currentPhase]} transition-all duration-100`}
                                style={{ width: `${task.phaseProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {task.result && (
                          <div className="mt-1 pt-1 border-t border-slate-700/30 text-green-400 space-y-1">
                            <div className="flex gap-3 flex-wrap">
                              <span>平均SNR: {task.result.avgSNR.toFixed(1)} dB</span>
                              <span>最大SNR: {task.result.maxSNR?.toFixed(1) || '-'} dB</span>
                            </div>
                            <div className="flex gap-3 flex-wrap">
                              <span>平均强度: {task.result.avgSignalStrength.toFixed(3)}</span>
                              <span>峰值频率: {task.result.peakFrequency.toFixed(1)} MHz</span>
                            </div>
                          </div>
                        )}
                        
                        {task.error && (
                          <div className="mt-1 pt-1 border-t border-slate-700/30 text-red-400">
                            错误: {task.error}
                          </div>
                        )}
                        
                        {isExpanded && task.status === 'completed' && renderTimeSeriesCharts(task)}
                        
                        {isReplayingThis && task.timeSeriesData && (
                          <div className="mt-3 pt-2 border-t border-purple-500/30">
                            <div className="flex items-center gap-2 mb-2">
                              <button
                                onClick={toggleReplayPause}
                                className="p-1 hover:bg-purple-500/20 rounded text-purple-400"
                              >
                                {replayPaused ? <Play size={14} /> : <Pause size={14} />}
                              </button>
                              <input
                                type="range"
                                min="0"
                                max={task.timeSeriesData.timestamps.length - 1}
                                value={Math.floor(replayTime)}
                                onChange={(e) => handleReplaySliderChange(task.id, parseFloat(e.target.value))}
                                className="flex-1 accent-purple-500"
                              />
                              <span className="text-xs font-mono text-purple-300 w-12 text-right">
                                {Math.floor(replayTime)}s
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 ml-2">
                      {task.status === 'pending' && !isRunning && !isReplayMode && (
                        <>
                          <button
                            onClick={() => moveTaskUp(task.id)}
                            disabled={index === 0}
                            className="p-1 hover:bg-slate-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="上移"
                          >
                            <ChevronUp size={14} className="text-slate-400" />
                          </button>
                          <button
                            onClick={() => moveTaskDown(task.id)}
                            disabled={index === observationTasks.length - 1}
                            className="p-1 hover:bg-slate-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="下移"
                          >
                            <ChevronDown size={14} className="text-slate-400" />
                          </button>
                        </>
                      )}
                      
                      {task.status !== 'running' && !isReplayMode && (
                        <button
                          onClick={() => handleGotoTask(task)}
                          className="p-1 hover:bg-cyan-500/20 rounded"
                          title="指向此目标"
                        >
                          <Target size={14} className="text-cyan-400" />
                        </button>
                      )}
                      
                      {task.status === 'completed' && task.timeSeriesData && task.timeSeriesData.timestamps.length > 0 && (
                        <button
                          onClick={() => {
                            if (replayTaskId === task.id && isReplayMode) {
                              stopReplay();
                            } else {
                              startReplay(task.id);
                            }
                          }}
                          className={`p-1 rounded ${
                            isReplayingThis ? 'bg-purple-500/30 text-purple-300' : 'hover:bg-purple-500/20 text-purple-400'
                          }`}
                          title={isReplayingThis ? '停止回放' : '回放观测数据'}
                        >
                          {isReplayingThis ? <Square size={14} /> : <Radio size={14} />}
                        </button>
                      )}
                      
                      {task.status === 'pending' && !isRunning && !isReplayMode && (
                        <button
                          onClick={() => removeObservationTask(task.id)}
                          className="p-1 hover:bg-red-500/20 rounded"
                          title="删除任务"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      )}
                      
                      {task.status === 'completed' && (
                        <button
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          className={`p-1 rounded ${
                            isExpanded ? 'bg-slate-600/50 text-cyan-300' : 'hover:bg-slate-700/50 text-slate-400'
                          }`}
                          title="展开/收起详情"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
          <div className="text-xs text-yellow-400 font-mono">
            💡 每个任务包含准备→校准→观测→收尾四个阶段，校准阶段会确保目标稳定在波束内再开始记录。完成后可点击回放按钮查看 SNR 时间曲线。
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
