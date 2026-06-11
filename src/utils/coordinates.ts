import { TELESCOPE_CONFIG, SCALE_FACTOR } from '@/data/config';
import type { FeedPosition } from '@/types';

const DEG_TO_RAD = Math.PI / 180;

export function altAzToFeedPosition(
  azimuth: number,
  altitude: number
): FeedPosition {
  const azRad = azimuth * DEG_TO_RAD;
  const altRad = altitude * DEG_TO_RAD;
  
  const focalLength = TELESCOPE_CONFIG.focalLength * SCALE_FACTOR;
  
  const x = -focalLength * Math.cos(altRad) * Math.sin(azRad);
  const z = -focalLength * Math.cos(altRad) * Math.cos(azRad);
  const y = focalLength * Math.sin(altRad);
  
  return { x, y, z };
}

export function feedPositionToAltAz(
  position: FeedPosition
): { azimuth: number; altitude: number } {
  const { x, y, z } = position;
  const focalLength = TELESCOPE_CONFIG.focalLength * SCALE_FACTOR;
  
  const r = Math.sqrt(x * x + y * y + z * z);
  const altRad = Math.asin(y / r);
  let azRad = Math.atan2(-x, -z);
  
  if (azRad < 0) azRad += 2 * Math.PI;
  
  const altitude = altRad * 180 / Math.PI;
  const azimuth = azRad * 180 / Math.PI;
  
  return { azimuth, altitude };
}

export function clampAltitude(altitude: number): number {
  return Math.max(TELESCOPE_CONFIG.minAltitude, 
                  Math.min(TELESCOPE_CONFIG.maxAltitude, altitude));
}

export function normalizeAzimuth(azimuth: number): number {
  let az = azimuth % 360;
  if (az < 0) az += 360;
  return az;
}

export function angularDistanceDeg(
  az1: number, alt1: number,
  az2: number, alt2: number
): number {
  const az1Rad = az1 * DEG_TO_RAD;
  const alt1Rad = alt1 * DEG_TO_RAD;
  const az2Rad = az2 * DEG_TO_RAD;
  const alt2Rad = alt2 * DEG_TO_RAD;
  
  const cosTheta = Math.sin(alt1Rad) * Math.sin(alt2Rad) +
                   Math.cos(alt1Rad) * Math.cos(alt2Rad) * Math.cos(az1Rad - az2Rad);
  
  return Math.acos(Math.max(-1, Math.min(1, cosTheta))) * 180 / Math.PI;
}

export function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180;
  return a + diff * t;
}

export function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function vectorToAltAz(
  dirX: number, dirY: number, dirZ: number
): { azimuth: number; altitude: number } {
  const length = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
  const nx = dirX / length;
  const ny = dirY / length;
  const nz = dirZ / length;
  
  const altitude = Math.asin(ny) * 180 / Math.PI;
  let azimuth = Math.atan2(-nx, -nz) * 180 / Math.PI;
  if (azimuth < 0) azimuth += 360;
  
  return { azimuth, altitude };
}
