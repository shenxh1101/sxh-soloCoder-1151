import type { RecordedData } from '@/types';

export function exportToCSV(data: RecordedData[]): void {
  if (data.length === 0) {
    alert('没有可导出的数据');
    return;
  }
  
  const headers = [
    '时间戳',
    '赤经 (时)',
    '赤纬 (度)',
    '方位角 (度)',
    '高度角 (度)',
    '频率 (MHz)',
    '增益 (dB)',
    '信号强度',
    '信噪比 (dB)',
    '观测质量',
    '天气',
    '指向误差 (度)',
    '目标在波束内',
  ];
  
  const weatherMap: Record<string, string> = {
    clear: '晴天',
    fog: '雾天',
    rain: '雨天',
  };
  
  const rows = data.map(record => [
    new Date(record.timestamp).toISOString(),
    record.ra.toFixed(6),
    record.dec.toFixed(6),
    record.azimuth.toFixed(2),
    record.altitude.toFixed(2),
    record.frequency.toFixed(2),
    record.gain.toFixed(1),
    record.signalStrength.toFixed(6),
    record.snr.toFixed(2),
    record.quality.toString(),
    weatherMap[record.weather] || record.weather,
    record.pointingError?.toFixed(4) || '0',
    record.targetInBeam ? '是' : '否',
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
  
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `telescope_observation_${timestamp}.csv`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function exportSpectrumToCSV(spectrumHistory: number[][], centerFrequency: number, startTime: number): void {
  if (spectrumHistory.length === 0) {
    alert('没有可导出的频谱数据');
    return;
  }
  
  const bandwidth = 10;
  const binCount = spectrumHistory[0]?.length || 256;
  const freqStep = bandwidth / binCount;
  const frequencies = Array.from({ length: binCount }, (_, i) => centerFrequency - bandwidth / 2 + i * freqStep);
  
  const headers = ['时间索引', '相对时间 (s)', ...frequencies.map(f => `${f.toFixed(2)} MHz`)];
  
  const timeStep = 0.05;
  const rows = spectrumHistory.map((row, index) => [
    index.toString(),
    (index * timeStep).toFixed(3),
    ...row.map(v => v.toExponential(4)),
  ]);
  
  const metadata = [
    `# 频谱数据导出`,
    `# 导出时间: ${new Date().toISOString()}`,
    `# 观测开始时间: ${new Date(startTime).toISOString()}`,
    `# 中心频率: ${centerFrequency.toFixed(2)} MHz`,
    `# 带宽: ${bandwidth} MHz`,
    `# 频率分辨率: ${freqStep.toFixed(4)} MHz`,
    `# 时间分辨率: ${timeStep.toFixed(3)} s`,
    `# 频谱帧数: ${spectrumHistory.length}`,
    '',
  ];
  
  const csvContent = [
    ...metadata,
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
  
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `telescope_spectrum_${timestamp}.csv`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
