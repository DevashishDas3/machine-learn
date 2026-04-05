"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Sphere } from "@react-three/drei";
import * as THREE from "three";

const AZURE = "#0080FE";

interface NodeData {
  position: THREE.Vector3;
  type: "input" | "process" | "output";
  pulseSpeed: number;
  pulseOffset: number;
}

interface PathData {
  points: THREE.Vector3[];
  particleProgress: number;
  speed: number;
}

function PulsingNode({ 
  position, 
  type, 
  pulseSpeed, 
  pulseOffset 
}: NodeData) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const baseSize = type === "input" ? 0.12 : type === "output" ? 0.15 : 0.08;
  const intensity = type === "output" ? 1.5 : type === "input" ? 1.2 : 1;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * pulseSpeed + pulseOffset;
    const pulse = 0.8 + Math.sin(t) * 0.2;
    
    if (meshRef.current) {
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(pulse * 2.5);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 
        0.15 + Math.sin(t) * 0.1;
    }
  });

  return (
    <group position={position}>
      {/* Core node */}
      <Sphere ref={meshRef} args={[baseSize, 16, 16]}>
        <meshBasicMaterial color={AZURE} />
      </Sphere>
      {/* Glow */}
      <Sphere ref={glowRef} args={[baseSize * 2, 16, 16]}>
        <meshBasicMaterial 
          color={AZURE} 
          transparent 
          opacity={0.2} 
          depthWrite={false}
        />
      </Sphere>
      {/* Outer glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[baseSize * 1.5 * intensity, baseSize * 1.8 * intensity, 32]} />
        <meshBasicMaterial 
          color={AZURE} 
          transparent 
          opacity={0.1} 
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function TravelingParticle({ 
  path, 
  progress, 
  speed 
}: { 
  path: THREE.Vector3[]; 
  progress: number; 
  speed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(progress);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(path), [path]);

  useFrame((_, delta) => {
    progressRef.current = (progressRef.current + delta * speed) % 1;
    if (meshRef.current) {
      const point = curve.getPoint(progressRef.current);
      meshRef.current.position.copy(point);
    }
  });

  return (
    <Sphere ref={meshRef} args={[0.04, 8, 8]}>
      <meshBasicMaterial color="#ffffff" />
    </Sphere>
  );
}

function WireframePath({ points }: { points: THREE.Vector3[] }) {
  return (
    <Line
      points={points}
      color={AZURE}
      lineWidth={1}
      transparent
      opacity={0.4}
    />
  );
}

function PipelineScene() {
  const groupRef = useRef<THREE.Group>(null);

  // Define the pipeline layout
  const nodes: NodeData[] = useMemo(() => [
    // Input node (left)
    { position: new THREE.Vector3(-3, 0, 0), type: "input", pulseSpeed: 2, pulseOffset: 0 },
    
    // Splitting point
    { position: new THREE.Vector3(-1.5, 0, 0), type: "process", pulseSpeed: 3, pulseOffset: 1 },
    
    // Parallel approach nodes (Plan, Implement, Tune phases represented as parallel paths)
    { position: new THREE.Vector3(0, 1.2, 0), type: "process", pulseSpeed: 4, pulseOffset: 0.5 },
    { position: new THREE.Vector3(0, 0, 0), type: "process", pulseSpeed: 5, pulseOffset: 1.5 },
    { position: new THREE.Vector3(0, -1.2, 0), type: "process", pulseSpeed: 4.5, pulseOffset: 2 },
    
    // Convergence point
    { position: new THREE.Vector3(1.5, 0, 0), type: "process", pulseSpeed: 3, pulseOffset: 2.5 },
    
    // Output node (right)
    { position: new THREE.Vector3(3, 0, 0), type: "output", pulseSpeed: 2, pulseOffset: 3 },
  ], []);

  // Define paths for particles
  const paths: PathData[] = useMemo(() => [
    // Path 1: Top route
    {
      points: [
        new THREE.Vector3(-3, 0, 0),
        new THREE.Vector3(-1.5, 0, 0),
        new THREE.Vector3(-0.75, 0.6, 0),
        new THREE.Vector3(0, 1.2, 0),
        new THREE.Vector3(0.75, 0.6, 0),
        new THREE.Vector3(1.5, 0, 0),
        new THREE.Vector3(3, 0, 0),
      ],
      particleProgress: 0,
      speed: 0.15,
    },
    // Path 2: Middle route
    {
      points: [
        new THREE.Vector3(-3, 0, 0),
        new THREE.Vector3(-1.5, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1.5, 0, 0),
        new THREE.Vector3(3, 0, 0),
      ],
      particleProgress: 0.33,
      speed: 0.18,
    },
    // Path 3: Bottom route
    {
      points: [
        new THREE.Vector3(-3, 0, 0),
        new THREE.Vector3(-1.5, 0, 0),
        new THREE.Vector3(-0.75, -0.6, 0),
        new THREE.Vector3(0, -1.2, 0),
        new THREE.Vector3(0.75, -0.6, 0),
        new THREE.Vector3(1.5, 0, 0),
        new THREE.Vector3(3, 0, 0),
      ],
      particleProgress: 0.66,
      speed: 0.12,
    },
  ], []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Subtle floating animation
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.2) * 0.05;
      groupRef.current.rotation.x = Math.cos(clock.getElapsedTime() * 0.15) * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Wireframe paths */}
      {paths.map((path, i) => (
        <WireframePath key={`path-${i}`} points={path.points} />
      ))}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <PulsingNode key={`node-${i}`} {...node} />
      ))}

      {/* Traveling particles - multiple per path */}
      {paths.flatMap((path, i) => [
        <TravelingParticle 
          key={`particle-${i}-0`} 
          path={path.points} 
          progress={path.particleProgress} 
          speed={path.speed} 
        />,
        <TravelingParticle 
          key={`particle-${i}-1`} 
          path={path.points} 
          progress={(path.particleProgress + 0.5) % 1} 
          speed={path.speed} 
        />
      ])}

      {/* Phase labels as floating points */}
      <PhaseLabel position={[-3, -0.4, 0]} label="INPUT" />
      <PhaseLabel position={[0, 1.6, 0]} label="PLAN" />
      <PhaseLabel position={[0, 0.4, 0]} label="IMPLEMENT" />
      <PhaseLabel position={[0, -1.6, 0]} label="TUNE" />
      <PhaseLabel position={[3, -0.4, 0]} label="REPORT" />
    </group>
  );
}

function PhaseLabel({ position, label }: { position: [number, number, number]; label: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 2) * 0.02;
    }
  });

  // We'll use small spheres as markers since text would require additional setup
  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.02, 8, 8]} />
      <meshBasicMaterial color={AZURE} transparent opacity={0.6} />
    </mesh>
  );
}

export default function SwarmPipelineCanvas() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <PipelineScene />
        <ambientLight intensity={0.5} />
      </Canvas>
      {/* Gradient overlay for depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-radial from-transparent via-obsidian/50 to-obsidian" />
    </div>
  );
}
