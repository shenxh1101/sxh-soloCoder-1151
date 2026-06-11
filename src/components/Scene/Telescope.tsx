import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import { TELESCOPE_CONFIG, SCALE_FACTOR, TOWER_POSITIONS, COLORS } from '@/data/config';

const DISH_RADIUS = (TELESCOPE_CONFIG.diameter / 2) * SCALE_FACTOR;
const DISH_SEGMENTS = 64;

export function Telescope() {
  const dishRef = useRef<THREE.Mesh>(null);
  const feedRef = useRef<THREE.Group>(null);
  const cablesRef = useRef<THREE.Group>(null);
  
  const feedPosition = useTelescopeStore(state => state.feedPosition);
  const trackingStatus = useTelescopeStore(state => state.trackingStatus);
  const isRecording = useTelescopeStore(state => state.isRecording);
  
  const [dishGeometry, dishPositions] = useMemo(() => {
    const geometry = new THREE.SphereGeometry(DISH_RADIUS, DISH_SEGMENTS, 32, 0, Math.PI * 2, 0, Math.PI / 3);
    const positions = geometry.attributes.position;
    const vertices: number[][] = [];
    
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      vertices.push([positions.getX(i), y, positions.getZ(i)]);
    }
    
    return [geometry, vertices];
  }, []);
  
  const towerGeometry = useMemo(() => new THREE.CylinderGeometry(0.3, 0.5, 6, 8), []);
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (feedRef.current) {
      feedRef.current.position.set(feedPosition.x, feedPosition.y, feedPosition.z);
      
      const targetDir = new THREE.Vector3(-feedPosition.x, -feedPosition.y, -feedPosition.z).normalize();
      feedRef.current.lookAt(targetDir);
      
      const indicator = feedRef.current.children[1] as THREE.Mesh;
      if (indicator) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 3);
        const intensity = isRecording ? 1 : (trackingStatus === 'tracking' ? 0.7 : 0.3);
        const mat = indicator.material as THREE.MeshBasicMaterial;
        mat.opacity = pulse * intensity;
      }
    }
    
    if (cablesRef.current) {
      cablesRef.current.children.forEach((line, index) => {
        const towerPos = TOWER_POSITIONS[index];
        const geometry = (line as THREE.LineSegments).geometry as THREE.BufferGeometry;
        const positions = geometry.attributes.position as THREE.BufferAttribute;
        
        positions.setXYZ(0, towerPos.x, towerPos.y, towerPos.z);
        positions.setXYZ(1, feedPosition.x, feedPosition.y, feedPosition.z);
        positions.needsUpdate = true;
      });
    }
    
    if (dishRef.current && trackingStatus === 'tracking') {
      const mat = dishRef.current.material as THREE.MeshStandardMaterial;
      const glow = 0.05 + 0.05 * Math.sin(time * 2);
      mat.emissiveIntensity = glow;
    }
  });
  
  const feedLightIntensity = trackingStatus === 'tracking' ? 2 : trackingStatus === 'moving' ? 1 : 0.5;
  
  return (
    <group>
      <mesh ref={dishRef} geometry={dishGeometry} rotation={[0, 0, 0]}>
        <meshStandardMaterial
          color={COLORS.dish}
          metalness={0.9}
          roughness={0.2}
          side={THREE.DoubleSide}
          emissive={COLORS.signal}
          emissiveIntensity={0}
        />
      </mesh>
      
      {dishPositions.filter((_, i) => i % 4 === 0).map((pos, i) => (
        <mesh key={i} position={[pos[0] * 1.001, pos[1] * 1.001, pos[2] * 1.001]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={COLORS.metal} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      
      {TOWER_POSITIONS.map((pos, i) => (
        <mesh key={`tower-${i}`} position={[pos.x, pos.y / 2, pos.z]} geometry={towerGeometry}>
          <meshStandardMaterial color="#4a5568" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      
      {TOWER_POSITIONS.map((pos, i) => (
        <mesh key={`pulley-${i}`} position={[pos.x, pos.y + 0.3, pos.z]}>
          <cylinderGeometry args={[0.2, 0.2, 0.15, 16]} />
          <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      
      <group ref={cablesRef}>
        {TOWER_POSITIONS.map((_, i) => (
          <lineSegments key={`cable-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([
                  TOWER_POSITIONS[i].x, TOWER_POSITIONS[i].y, TOWER_POSITIONS[i].z,
                  0, 0, 0
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={COLORS.cable} transparent opacity={0.8} />
          </lineSegments>
        ))}
      </group>
      
      <group ref={feedRef}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.6, 0.8, 1.2, 6]} />
          <meshStandardMaterial color={COLORS.feed} metalness={0.7} roughness={0.3} />
        </mesh>
        
        <mesh position={[0, 0.7, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial
            color={isRecording ? COLORS.success : trackingStatus === 'tracking' ? COLORS.signal : COLORS.warning}
            transparent
            opacity={0.5}
          />
        </mesh>
        
        <pointLight
          position={[0, 0, 0]}
          color={COLORS.signal}
          intensity={feedLightIntensity}
          distance={20}
        />
        
        <mesh position={[0, 0, -0.6]}>
          <coneGeometry args={[0.4, 0.8, 6]} />
          <meshStandardMaterial color="#4a5568" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <mesh
            key={`antenna-${i}`}
            position={[
              Math.cos(angle * Math.PI / 180) * 0.5,
              0,
              Math.sin(angle * Math.PI / 180) * 0.5
            ]}
          >
            <cylinderGeometry args={[0.03, 0.03, 0.3, 4]} />
            <meshStandardMaterial color="#2d3748" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
      </group>
      
      <mesh position={[0, -0.1, 0]}>
        <ringGeometry args={[DISH_RADIUS + 0.2, DISH_RADIUS + 0.5, 64]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}
