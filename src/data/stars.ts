import type { StarData } from '@/types';

export const BRIGHT_STARS: StarData[] = [
  { id: 'sirius', name: '天狼星 (Sirius)', ra: 6.7525, dec: -16.7161, magnitude: -1.46, color: '#ffffff' },
  { id: 'canopus', name: '老人星 (Canopus)', ra: 6.3992, dec: -52.6957, magnitude: -0.74, color: '#fff8e7' },
  { id: 'rigil', name: '南门二 (Rigil Kentaurus)', ra: 14.0637, dec: -60.8339, magnitude: -0.27, color: '#fff8e7' },
  { id: 'arcturus', name: '大角星 (Arcturus)', ra: 14.2611, dec: 19.1825, magnitude: -0.05, color: '#ffc880' },
  { id: 'vega', name: '织女星 (Vega)', ra: 18.6156, dec: 38.7837, magnitude: 0.03, color: '#e8f4ff' },
  { id: 'capella', name: '五车二 (Capella)', ra: 5.2782, dec: 45.9979, magnitude: 0.08, color: '#fff8e7' },
  { id: 'rigel', name: '参宿七 (Rigel)', ra: 5.2423, dec: -8.2016, magnitude: 0.13, color: '#d4e8ff' },
  { id: 'procyon', name: '南河三 (Procyon)', ra: 7.6551, dec: 5.2249, magnitude: 0.34, color: '#fff8e7' },
  { id: 'betelgeuse', name: '参宿四 (Betelgeuse)', ra: 5.9195, dec: 7.407, magnitude: 0.42, color: '#ff8060' },
  { id: 'achernar', name: '水委一 (Achernar)', ra: 1.6285, dec: -57.2367, magnitude: 0.46, color: '#d4e8ff' },
  { id: 'hadar', name: '马腹一 (Hadar)', ra: 14.0637, dec: -59.6889, magnitude: 0.61, color: '#d4e8ff' },
  { id: 'altair', name: '牵牛星 (Altair)', ra: 19.8463, dec: 8.8683, magnitude: 0.77, color: '#fff8e7' },
  { id: 'acrux', name: '十字架二 (Acrux)', ra: 12.4433, dec: -63.099, magnitude: 0.77, color: '#d4e8ff' },
  { id: 'aldebaran', name: '毕宿五 (Aldebaran)', ra: 4.5987, dec: 16.5093, magnitude: 0.87, color: '#ff8060' },
  { id: 'antares', name: '心宿二 (Antares)', ra: 16.4901, dec: -26.432, magnitude: 0.96, color: '#ff8060' },
  { id: 'spica', name: '角宿一 (Spica)', ra: 13.4199, dec: -11.1614, magnitude: 0.97, color: '#d4e8ff' },
  { id: 'pollux', name: '北河三 (Pollux)', ra: 7.7553, dec: 28.0262, magnitude: 1.14, color: '#fff8e7' },
  { id: 'fomalhaut', name: '北落师门 (Fomalhaut)', ra: 22.9607, dec: -29.6222, magnitude: 1.16, color: '#fff8e7' },
  { id: 'deneb', name: '天津四 (Deneb)', ra: 20.6907, dec: 45.2803, magnitude: 1.25, color: '#fff8e7' },
  { id: 'regulus', name: '轩辕十四 (Regulus)', ra: 10.1396, dec: 11.9673, magnitude: 1.35, color: '#d4e8ff' },
  { id: 'castor', name: '北河二 (Castor)', ra: 7.5765, dec: 31.8883, magnitude: 1.58, color: '#fff8e7' },
  { id: 'bellatrix', name: '参宿五 (Bellatrix)', ra: 5.4126, dec: 6.3497, magnitude: 1.64, color: '#d4e8ff' },
  { id: 'polaris', name: '北极星 (Polaris)', ra: 2.5302, dec: 89.2641, magnitude: 1.98, color: '#fff8e7' },
  { id: 'mirfak', name: '天船三 (Mirfak)', ra: 3.4083, dec: 49.8612, magnitude: 1.79, color: '#fff8e7' },
  { id: 'algol', name: '大陵五 (Algol)', ra: 3.3667, dec: 40.9556, magnitude: 2.12, color: '#fff8e7' },
];

export const PULSARS: StarData[] = [
  { id: 'b0329+54', name: 'PSR B0329+54', ra: 3.5217, dec: 54.5797, magnitude: 8.0, color: '#00ff88', isPulsar: true },
  { id: 'b0531+21', name: '蟹状星云脉冲星', ra: 5.5653, dec: 22.0145, magnitude: 8.4, color: '#00ff88', isPulsar: true },
  { id: 'b1509-58', name: 'PSR B1509-58', ra: 15.2967, dec: -58.9439, magnitude: 9.0, color: '#00ff88', isPulsar: true },
  { id: 'b0833-45', name: '船帆座脉冲星', ra: 8.5558, dec: -45.1764, magnitude: 12.0, color: '#00ff88', isPulsar: true },
];

export const ALL_STARS = [...BRIGHT_STARS, ...PULSARS];

export function generateFaintStars(count: number): StarData[] {
  const stars: StarData[] = [];
  for (let i = 0; i < count; i++) {
    const ra = Math.random() * 24;
    const dec = (Math.random() - 0.5) * 180;
    const magnitude = 6 + Math.random() * 12;
    stars.push({
      id: `faint_${i}`,
      name: '',
      ra,
      dec,
      magnitude,
      color: '#ffffff',
    });
  }
  return stars;
}
