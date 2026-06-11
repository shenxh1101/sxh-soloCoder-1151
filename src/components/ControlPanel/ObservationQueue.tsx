import { useState, useMemo } from 'react';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import { GlassPanel } from '@/components/UI/GlassPanel';
import { GlowButton } from '@/components/UI/GlowButton';
import { ALL_STARS } from '@/data/stars';
import { formatRA, formatDec } from '@/utils/astronomy';
import { ListTodo, Play, Square, Plus, Trash2, ChevronUp, ChevronDown, CheckCircle, XCircle, Clock, Loader } from 'lucide-react';
import type { StarData, ObservationTask } from '@/types';

export function ObservationQueue() {
  const observationTasks = useTelescopeStore(state => state.observationTasks);
  const currentTaskIndex = useTelescopeStore(state => state.currentTaskIndex);
  
  const addObservationTask = useTelescopeStore(state => state.addObservationTask);
  const removeObservationTask = useTelescopeStore(state => state.removeObservationTask);
  const startObservationQueue = useTelescopeStore(state => state.startObservationQueue);
  const stopObservationQueue = useTelescopeStore(state => state.stopObservationQueue);
  const clearObservationQueue = useTelescopeStore(state => state.clearObservationQueue);
  const moveTaskUp = useTelescopeStore(state => state.moveTaskUp);
  const moveTaskDown = useTelescopeStore(state => state.moveTaskDown);
  const setTargetByStar = useTelescopeStore(state => state.setTargetByStar);
  const setTargetByRADec = useTelescopeStore(state => state.setTargetByRADec);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState<'star' | 'radec'>('star');
  const [selectedStarId, setSelectedStarId] = useState<string>('');
  const [manualRA, setManualRA] = useState('12.0');
  const [manualDec, setManualDec] = useState('0.0');
  const [taskDuration, setTaskDuration] = useState('30');
  const [autoRecord, setAutoRecord] = useState(true);
  
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
  
  const completedCount = observationTasks.filter(t => t.status === 'completed').length;
  const totalDuration = observationTasks.reduce((sum, t) => sum + t.duration, 0);
  
  return (
    <GlassPanel
      title="观测任务队列"
      icon={<ListTodo size={16} />}
      collapsible
      defaultCollapsed
    >
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="text-xs font-mono text-slate-400">
            <span>共 {observationTasks.length} 个任务</span>
            <span className="mx-2">|</span>
            <span>已完成 {completedCount}</span>
            <span className="mx-2">|</span>
            <span>预计总时长 {totalDuration}s</span>
          </div>
          <div className="flex gap-2">
            {!isRunning ? (
              <GlowButton
                onClick={startObservationQueue}
                size="xs"
                variant="success"
                icon={<Play size={12} />}
                disabled={observationTasks.length === 0 || observationTasks.every(t => t.status === 'completed')}
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
              disabled={observationTasks.length === 0}
            >
              清空
            </GlowButton>
          </div>
        </div>
        
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
        
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {observationTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 font-mono text-sm">
              暂无观测任务，点击"添加任务"开始
            </div>
          ) : (
            observationTasks.map((task, index) => (
              <div
                key={task.id}
                className={`p-3 rounded border transition-all ${
                  currentTaskIndex === index && task.status === 'running'
                    ? 'bg-cyan-500/10 border-cyan-500/50'
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
                    </div>
                    
                    <div className="text-xs font-mono text-slate-400 space-y-0.5">
                      <div>
                        RA: {formatRA(task.targetRA)} | Dec: {formatDec(task.targetDec)}
                      </div>
                      <div className="flex gap-4">
                        <span>时长: {task.duration}s</span>
                        <span>记录: {task.recordData ? '是' : '否'}</span>
                      </div>
                      
                      {task.result && (
                        <div className="mt-1 pt-1 border-t border-slate-700/30 text-green-400">
                          <span className="mr-3">平均SNR: {task.result.avgSNR.toFixed(1)} dB</span>
                          <span className="mr-3">平均强度: {task.result.avgSignalStrength.toFixed(3)}</span>
                          <span className="mr-3">峰值频率: {task.result.peakFrequency.toFixed(1)} MHz</span>
                          <span>数据点: {task.result.dataPoints}</span>
                        </div>
                      )}
                      
                      {task.error && (
                        <div className="mt-1 pt-1 border-t border-slate-700/30 text-red-400">
                          错误: {task.error}
                        </div>
                      )}
                    </div>
                    
                    {task.status === 'running' && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                          <span>进度</span>
                          <span>{task.progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-1 ml-2">
                    {task.status === 'pending' && (
                      <>
                        <button
                          onClick={() => moveTaskUp(task.id)}
                          disabled={index === 0}
                          className="p-1 hover:bg-slate-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUp size={14} className="text-slate-400" />
                        </button>
                        <button
                          onClick={() => moveTaskDown(task.id)}
                          disabled={index === observationTasks.length - 1}
                          className="p-1 hover:bg-slate-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDown size={14} className="text-slate-400" />
                        </button>
                      </>
                    )}
                    
                    {task.status !== 'running' && (
                      <button
                        onClick={() => handleGotoTask(task)}
                        className="p-1 hover:bg-cyan-500/20 rounded"
                        title="指向此目标"
                      >
                        <Play size={14} className="text-cyan-400" />
                      </button>
                    )}
                    
                    {task.status === 'pending' && (
                      <button
                        onClick={() => removeObservationTask(task.id)}
                        className="p-1 hover:bg-red-500/20 rounded"
                        title="删除任务"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
          <div className="text-xs text-yellow-400 font-mono">
            💡 提示: 任务队列会按顺序自动执行观测，包括指向目标、跟踪和数据记录。执行完成后可查看每个任务的观测结果统计。
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
