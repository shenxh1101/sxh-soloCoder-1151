import { TELESCOPE_CONFIG } from '@/data/config';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function julianDate(date: Date = new Date()): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + 
    (date.getUTCHours() + 
     date.getUTCMinutes() / 60 + 
     date.getUTCSeconds() / 3600) / 24;
  
  let jy = y;
  let jm = m;
  if (jm <= 2) {
    jy--;
    jm += 12;
  }
  
  const ja = Math.floor(jy / 100);
  const jb = 2 - ja + Math.floor(ja / 4);
  
  return Math.floor(365.25 * (jy + 4716)) + 
         Math.floor(30.6001 * (jm + 1)) + 
         d + jb - 1524.5;
}

export function meanSiderealTime(date: Date = new Date(), longitude: number = TELESCOPE_CONFIG.observationLongitude): number {
  const jd = julianDate(date);
  const jd0 = Math.floor(jd - 0.5) + 0.5;
  const t = (jd0 - 2451545.0) / 36525.0;
  
  let gst = 6.697374558 + 2400.051336 * t + 0.000025862 * t * t;
  gst += (jd - jd0) * 24 * 1.00273790935;
  gst = ((gst % 24) + 24) % 24;
  
  const lst = gst + longitude / 15;
  return ((lst % 24) + 24) % 24;
}

export function equatorialToHorizontal(
  ra: number,
  dec: number,
  date: Date = new Date(),
  latitude: number = TELESCOPE_CONFIG.observationLatitude,
  longitude: number = TELESCOPE_CONFIG.observationLongitude
): { azimuth: number; altitude: number; hourAngle: number } {
  const lst = meanSiderealTime(date, longitude);
  const hourAngle = ((lst - ra) % 24 + 24) % 24;
  
  const haRad = hourAngle * 15 * DEG_TO_RAD;
  const decRad = dec * DEG_TO_RAD;
  const latRad = latitude * DEG_TO_RAD;
  
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + 
                 Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * RAD_TO_DEG;
  
  const cosAlt = Math.cos(altitude * DEG_TO_RAD);
  const y = -Math.cos(decRad) * Math.sin(haRad);
  const x = Math.sin(decRad) * Math.cos(latRad) - 
            Math.cos(decRad) * Math.sin(latRad) * Math.cos(haRad);
  
  let azimuth = Math.atan2(y, x) * RAD_TO_DEG;
  azimuth = ((azimuth % 360) + 360) % 360;
  
  return { azimuth, altitude, hourAngle };
}

export function horizontalToEquatorial(
  azimuth: number,
  altitude: number,
  date: Date = new Date(),
  latitude: number = TELESCOPE_CONFIG.observationLatitude,
  longitude: number = TELESCOPE_CONFIG.observationLongitude
): { ra: number; dec: number; hourAngle: number } {
  const azRad = azimuth * DEG_TO_RAD;
  const altRad = altitude * DEG_TO_RAD;
  const latRad = latitude * DEG_TO_RAD;
  
  const sinDec = Math.sin(altRad) * Math.sin(latRad) + 
                 Math.cos(altRad) * Math.cos(latRad) * Math.cos(azRad);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec))) * RAD_TO_DEG;
  
  const cosDec = Math.cos(dec * DEG_TO_RAD);
  const y = -Math.cos(altRad) * Math.sin(azRad);
  const x = Math.sin(altRad) * Math.cos(latRad) - 
            Math.cos(altRad) * Math.sin(latRad) * Math.cos(azRad);
  
  let hourAngle = Math.atan2(y, x) * RAD_TO_DEG / 15;
  hourAngle = ((hourAngle % 24) + 24) % 24;
  
  const lst = meanSiderealTime(date, longitude);
  let ra = lst - hourAngle;
  ra = ((ra % 24) + 24) % 24;
  
  return { ra, dec, hourAngle };
}

export function angularDistance(
  ra1: number, dec1: number,
  ra2: number, dec2: number
): number {
  const dec1Rad = dec1 * DEG_TO_RAD;
  const dec2Rad = dec2 * DEG_TO_RAD;
  const raDiff = (ra1 - ra2) * 15 * DEG_TO_RAD;
  
  const cosTheta = Math.sin(dec1Rad) * Math.sin(dec2Rad) + 
                   Math.cos(dec1Rad) * Math.cos(dec2Rad) * Math.cos(raDiff);
  
  return Math.acos(Math.max(-1, Math.min(1, cosTheta))) * RAD_TO_DEG;
}

export function formatRA(ra: number): string {
  const hours = Math.floor(ra);
  const minutes = Math.floor((ra - hours) * 60);
  const seconds = ((ra - hours) * 60 - minutes) * 60;
  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toFixed(1).padStart(4, '0')}s`;
}

export function formatDec(dec: number): string {
  const sign = dec >= 0 ? '+' : '-';
  const absDec = Math.abs(dec);
  const degrees = Math.floor(absDec);
  const minutes = Math.floor((absDec - degrees) * 60);
  const seconds = ((absDec - degrees) * 60 - minutes) * 60;
  return `${sign}${degrees.toString().padStart(2, '0')}° ${minutes.toString().padStart(2, '0')}' ${seconds.toFixed(1).padStart(4, '0')}"`;
}

export function formatAzimuth(az: number): string {
  return `${az.toFixed(1)}°`;
}

export function formatAltitude(alt: number): string {
  return `${alt.toFixed(1)}°`;
}

export const EARTH_ROTATION_RATE = 360 / 86164.0905;
