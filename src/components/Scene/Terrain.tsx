import { useMemo } from 'react';
import * as THREE from 'three';
import { SCALE_FACTOR } from '@/data/config';

const VALLEY_RADIUS = 800 * SCALE_FACTOR;
const TERRAIN_SEGMENTS = 128;
const MOUNTAIN_HEIGHT = 150 * SCALE_FACTOR;

function fbm(x: number, z: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 0.5;
  let maxValue = 0;
  
  for (let i = 0; i < octaves; i++) {
    value += amplitude * (Math.sin(x * frequency) * Math.cos(z * frequency) +
                          Math.sin(x * frequency * 2.3) * Math.cos(z * frequency * 1.7));
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  
  return value / maxValue;
}

export function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(VALLEY_RADIUS * 3, VALLEY_RADIUS * 3, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    const positions = geo.attributes.position;
    const colorArray = new Float32Array(positions.count * 3);
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      
      const distFromCenter = Math.sqrt(x * x + z * z);
      const normalizedDist = distFromCenter / VALLEY_RADIUS;
      
      let height = 0;
      
      if (normalizedDist < 1.2) {
        height = -MOUNTAIN_HEIGHT * 0.3 * (1 - normalizedDist / 1.2);
      } else {
        const mountainNoise = fbm(x * 0.01, z * 0.01, 3);
        height = MOUNTAIN_HEIGHT * (0.5 + 0.5 * mountainNoise) * 
                 Math.min(1, (normalizedDist - 1.2) / 0.5);
      }
      
      height += fbm(x * 0.03, z * 0.03, 2) * MOUNTAIN_HEIGHT * 0.1;
      
      positions.setZ(i, height);
      
      const normalizedHeight = (height + MOUNTAIN_HEIGHT * 0.3) / (MOUNTAIN_HEIGHT + MOUNTAIN_HEIGHT * 0.3);
      
      let r, g, b;
      if (normalizedHeight < 0.2) {
        r = 0.15; g = 0.18; b = 0.2;
      } else if (normalizedHeight < 0.5) {
        r = 0.2; g = 0.25; b = 0.22;
      } else if (normalizedHeight < 0.8) {
        r = 0.3; g = 0.35; b = 0.3;
      } else {
        r = 0.45; g = 0.48; b = 0.45;
      }
      
      const noise = (Math.random() - 0.5) * 0.05;
      colorArray[i * 3] = r + noise;
      colorArray[i * 3 + 1] = g + noise;
      colorArray[i * 3 + 2] = b + noise;
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    geo.computeVertexNormals();
    
    return geo;
  }, []);
  
  return (
    <group>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.9}
          metalness={0.1}
          flatShading
        />
      </mesh>
      
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[VALLEY_RADIUS * 1.15, VALLEY_RADIUS * 1.25, 64]} />
        <meshStandardMaterial color="#4a5568" roughness={0.8} />
      </mesh>
      
      {Array.from({ length: 20 }).map((_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        const radius = VALLEY_RADIUS * 1.2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        return (
          <mesh key={`fence-${i}`} position={[x, 0.5, z]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.15, 1, 0.15]} />
            <meshStandardMaterial color="#6b7280" roughness={0.7} />
          </mesh>
        );
      })}
      
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = VALLEY_RADIUS * (0.8 + Math.random() * 0.3);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = 1 + Math.random() * 3;
        
        return (
          <mesh key={`tree-${i}`} position={[x, height / 2, z]}>
            <coneGeometry args={[0.5, height, 6]} />
            <meshStandardMaterial color="#2d3748" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}
