import { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import { BRIGHT_STARS, PULSARS, generateFaintStars } from '@/data/stars';
import { equatorialToHorizontal } from '@/utils/astronomy';
import { SCALE_FACTOR } from '@/data/config';
import type { StarData } from '@/types';

const STAR_DISTANCE = 500 * SCALE_FACTOR;
const FAINT_STAR_COUNT = 4000;

function raDecToVector(ra: number, dec: number, distance: number, time: Date = new Date()): THREE.Vector3 {
  const { azimuth, altitude } = equatorialToHorizontal(ra, dec, time);
  const azRad = azimuth * Math.PI / 180;
  const altRad = altitude * Math.PI / 180;
  
  const x = -distance * Math.cos(altRad) * Math.sin(azRad);
  const y = distance * Math.sin(altRad);
  const z = -distance * Math.cos(altRad) * Math.cos(azRad);
  
  return new THREE.Vector3(x, y, z);
}

export function StarField() {
  const pointsRef = useRef<THREE.Points>(null);
  const brightStarsRef = useRef<THREE.Group>(null);
  const [hoveredStar, setHoveredStar] = useState<string | null>(null);
  const { camera } = useThree();
  
  const setTargetByStar = useTelescopeStore(state => state.setTargetByStar);
  const selectedStarId = useTelescopeStore(state => state.selectedStarId);
  
  const allStars = useMemo(() => {
    return [...BRIGHT_STARS, ...PULSARS];
  }, []);
  
  const faintStars = useMemo(() => generateFaintStars(FAINT_STAR_COUNT), []);
  
  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(FAINT_STAR_COUNT * 3);
    const colors = new Float32Array(FAINT_STAR_COUNT * 3);
    const sizes = new Float32Array(FAINT_STAR_COUNT);
    const now = new Date();
    
    for (let i = 0; i < FAINT_STAR_COUNT; i++) {
      const star = faintStars[i];
      const pos = raDecToVector(star.ra, star.dec, STAR_DISTANCE, now);
      
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      
      const brightness = Math.max(0.2, 1 - (star.magnitude - 6) / 10);
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
      sizes[i] = brightness * 0.3;
    }
    
    return { positions, colors, sizes };
  }, [faintStars]);
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const now = new Date();
    
    if (brightStarsRef.current) {
      brightStarsRef.current.children.forEach((child, index) => {
        const star = allStars[index];
        if (!star) return;
        
        const pos = raDecToVector(star.ra, star.dec, STAR_DISTANCE * 0.98, now);
        child.position.copy(pos);
        child.lookAt(0, 0, 0);
        
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshBasicMaterial;
          const twinkle = 0.8 + 0.2 * Math.sin(time * 2 + index);
          mat.opacity = twinkle;
        }
        
        if (star.id === selectedStarId) {
          child.scale.setScalar(2 + Math.sin(time * 4) * 0.3);
        } else if (hoveredStar === star.id) {
          child.scale.setScalar(1.5);
        } else {
          child.scale.setScalar(star.isPulsar ? 1.2 : 1);
        }
      });
    }
    
    if (pointsRef.current && pointsRef.current.material) {
      const mat = pointsRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.7 + 0.1 * Math.sin(time * 0.5);
    }
  });
  
  const handleStarClick = (star: StarData) => {
    setTargetByStar(star);
  };
  
  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={FAINT_STAR_COUNT}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={FAINT_STAR_COUNT}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.5}
          vertexColors
          transparent
          opacity={0.8}
          sizeAttenuation
        />
      </points>
      
      <group ref={brightStarsRef}>
        {allStars.map((star) => (
          <group key={star.id}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                handleStarClick(star);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredStar(star.id);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHoveredStar(null);
                document.body.style.cursor = 'default';
              }}
            >
              <sphereGeometry args={[star.isPulsar ? 0.8 : 0.6, 16, 16]} />
              <meshBasicMaterial
                color={star.color}
                transparent
                opacity={0.9}
              />
            </mesh>
            
            {(hoveredStar === star.id || selectedStarId === star.id) && star.name && (
              <sprite position={[0, 1.5, 0]} scale={[4, 2, 1]}>
                <spriteMaterial
                  color={selectedStarId === star.id ? '#00ff88' : '#00d4ff'}
                  transparent
                  opacity={0.9}
                />
              </sprite>
            )}
            
            {hoveredStar === star.id && (
              <mesh>
                <ringGeometry args={[1.5, 1.8, 32]} />
                <meshBasicMaterial
                  color="#00d4ff"
                  transparent
                  opacity={0.5}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
            
            {selectedStarId === star.id && (
              <mesh>
                <ringGeometry args={[2, 2.5, 4, 4]} />
                <meshBasicMaterial
                  color="#00ff88"
                  transparent
                  opacity={0.6}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
          </group>
        ))}
      </group>
      
      {hoveredStar && (
        <sprite
          position={new THREE.Vector3(0, 0, 0)}
          scale={[1, 1, 1]}
        />
      )}
    </group>
  );
}

export function StarTooltip() {
  const [hoveredStar, setHoveredStar] = useState<string | null>(null);
  const allStars = useMemo(() => [...BRIGHT_STARS, ...PULSARS], []);
  
  if (!hoveredStar) return null;
  
  const star = allStars.find(s => s.id === hoveredStar);
  if (!star) return null;
  
  return (
    <div className="fixed pointer-events-none z-50 bg-slate-900/90 border border-cyan-500/50 rounded px-3 py-2 font-mono text-xs text-cyan-300">
      <div className="font-bold text-cyan-400">{star.name}</div>
      <div>RA: {star.ra.toFixed(4)}h</div>
      <div>Dec: {star.dec.toFixed(4)}°</div>
      <div>星等: {star.magnitude.toFixed(2)}</div>
      {star.isPulsar && <div className="text-green-400">★ 脉冲星</div>}
    </div>
  );
}
