import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import type { WeatherType } from '@/types';

const RAIN_COUNT = 2000;
const FOG_COLORS: Record<WeatherType, string> = {
  clear: '#0a0e1a',
  fog: '#1a1f2e',
  rain: '#0f141e',
};

const FOG_DENSITY: Record<WeatherType, number> = {
  clear: 0.002,
  fog: 0.015,
  rain: 0.008,
};

export function WeatherEffects() {
  const rainRef = useRef<THREE.Points>(null);
  const weather = useTelescopeStore(state => state.weather);
  const observationQuality = useTelescopeStore(state => state.observationQuality);
  
  const rainData = useMemo(() => {
    const positions = new Float32Array(RAIN_COUNT * 3);
    const velocities = new Float32Array(RAIN_COUNT);
    
    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = Math.random() * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      velocities[i] = 2 + Math.random() * 3;
    }
    
    return { positions, velocities };
  }, []);
  
  useFrame((_, delta) => {
    if (rainRef.current && weather === 'rain') {
      const positions = rainRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const arr = positions.array as Float32Array;
      
      for (let i = 0; i < RAIN_COUNT; i++) {
        arr[i * 3 + 1] -= rainData.velocities[i] * delta * 10;
        
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3 + 1] = 100;
          arr[i * 3] = (Math.random() - 0.5) * 200;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 200;
        }
      }
      
      positions.needsUpdate = true;
    }
  });
  
  const fogDensity = FOG_DENSITY[weather];
  const fogColor = FOG_COLORS[weather];
  
  const bloomIntensity = weather === 'clear' ? 0.5 : weather === 'fog' ? 0.2 : 0.3;
  
  return (
    <>
      <fog attach="fog" args={[fogColor, 10, 100 / fogDensity]} />
      <color attach="background" args={[fogColor]} />
      
      {weather === 'rain' && (
        <points ref={rainRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={RAIN_COUNT}
              array={rainData.positions}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            color="#88aacc"
            size={0.1}
            transparent
            opacity={0.6}
            sizeAttenuation
          />
        </points>
      )}
      
      <EffectComposer>
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Noise opacity={weather === 'rain' ? 0.05 : 0.02} />
        <Vignette offset={0.5} darkness={0.5} />
      </EffectComposer>
      
      {weather !== 'clear' && (
        <hemisphereLight
          color="#556677"
          groundColor="#223344"
          intensity={weather === 'fog' ? 0.3 : 0.5}
        />
      )}
    </>
  );
}

export function QualityIndicator() {
  const quality = useTelescopeStore(state => state.observationQuality);
  
  let qualityColor = '#00ff88';
  let qualityLabel = '优秀';
  
  if (quality < 40) {
    qualityColor = '#ff4444';
    qualityLabel = '较差';
  } else if (quality < 70) {
    qualityColor = '#ffaa00';
    qualityLabel = '一般';
  }
  
  return (
    <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur border border-cyan-500/30 rounded-lg px-4 py-2">
      <div className="text-xs text-slate-400 font-mono mb-1">观测质量</div>
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${quality}%`,
              backgroundColor: qualityColor,
              boxShadow: `0 0 10px ${qualityColor}`,
            }}
          />
        </div>
        <span className="font-mono text-sm" style={{ color: qualityColor }}>
          {quality}%
        </span>
        <span className="font-mono text-xs text-slate-400">{qualityLabel}</span>
      </div>
    </div>
  );
}
