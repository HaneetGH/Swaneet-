"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles as DreiSparkles } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import type { Mesh } from "three";
import * as THREE from "three";

function Orbs() {
  const ref = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d4af37",
        emissive: "#9a7b2f",
        emissiveIntensity: 0.35,
        metalness: 0.8,
        roughness: 0.25,
        transparent: true,
        opacity: 0.45,
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.08;
    ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.2) * 0.15;
  });

  return (
    <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.6}>
      <mesh ref={ref} material={material} position={[0, 0, -2]} scale={1.6}>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
    </Float>
  );
}

export function Scene3D() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0 opacity-60"
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <pointLight position={[3, 2, 4]} intensity={1.2} color="#e8d5a3" />
          <pointLight position={[-3, -1, 2]} intensity={0.6} color="#6b1d2a" />
          <Orbs />
          <DreiSparkles
            count={40}
            scale={[8, 5, 4]}
            size={2}
            speed={0.35}
            opacity={0.45}
            color="#e8d5a3"
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
