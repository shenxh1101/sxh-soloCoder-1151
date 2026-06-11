import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useTelescopeStore } from '@/store/useTelescopeStore';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';
import { Telescope } from './Telescope';
import { Terrain } from './Terrain';
import { StarField } from './StarField';
import { WeatherEffects } from './Weather';
import { SCALE_FACTOR } from '@/data/config';

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.1} />
      <directionalLight
        position={[50, 100, 50]}
        intensity={0.4}
        color="#e8f4ff"
        castShadow
      />
      <hemisphereLight
        color="#1a1f3a"
        groundColor="#0a0e1a"
        intensity={0.3}
      />
      <pointLight
        position={[0, 50, 0]}
        intensity={0.5}
        color="#00d4ff"
        distance={200}
      />
    </>
  );
}

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const feedPosition = useTelescopeStore(state => state.feedPosition);
  
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 5, 0);
    }
  });
  
  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={200}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI / 2 - 0.1}
      enablePan={false}
    />
  );
}

function SceneUpdater() {
  const updateSignalData = useTelescopeStore(state => state.updateSignalData);
  
  useAnimationFrame(() => {
    updateSignalData();
  }, true);
  
  return null;
}

function GridHelper() {
  return (
    <group>
      <gridHelper
        args={[200, 40, '#1e3a5f', '#0a1525']}
        position={[0, 0.02, 0]}
      />
    </group>
  );
}

function DirectionIndicator() {
  const azimuth = useTelescopeStore(state => state.azimuth);
  const altitude = useTelescopeStore(state => state.altitude);
  const feedPosition = useTelescopeStore(state => state.feedPosition);
  
  const azRad = azimuth * Math.PI / 180;
  const altRad = altitude * Math.PI / 180;
  const beamLength = 100 * SCALE_FACTOR;
  
  const dirX = -beamLength * Math.cos(altRad) * Math.sin(azRad);
  const dirY = beamLength * Math.sin(altRad);
  const dirZ = -beamLength * Math.cos(altRad) * Math.cos(azRad);
  
  const points = [
    new THREE.Vector3(feedPosition.x, feedPosition.y, feedPosition.z),
    new THREE.Vector3(feedPosition.x + dirX, feedPosition.y + dirY, feedPosition.z + dirZ),
  ];
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color="#00ff88"
        transparent
        opacity={0.4}
        linewidth={2}
      />
    </lineSegments>
  );
}

interface MainSceneProps {
  className?: string;
}

export function MainScene({ className }: MainSceneProps) {
  return (
    <div className={className}>
      <Canvas
        camera={{
          position: [60, 40, 60],
          fov: 60,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]}
      >
        <SceneLighting />
        <CameraController />
        <SceneUpdater />
        <WeatherEffects />
        
        <StarField />
        <Terrain />
        <Telescope />
        <DirectionIndicator />
        <GridHelper />
      </Canvas>
    </div>
  );
}
