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

export function exportSpectrumToCSV(spectrumHistory: number[][], frequencies: number[]): void {
  if (spectrumHistory.length === 0) {
    alert('没有可导出的频谱数据');
    return;
  }
  
  const headers = ['时间索引', ...frequencies.map(f => `${f.toFixed(1)} MHz`)];
  
  const rows = spectrumHistory.map((row, index) => [
    index.toString(),
    ...row.map(v => v.toExponential(4)),
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
  link.download = `telescope_spectrum_${timestamp}.csv`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
