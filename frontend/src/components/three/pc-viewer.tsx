'use client';

import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Suspense, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useViewerStore } from '@/lib/store';
import type { Part, PartType } from '@/lib/types';
import { PART_TYPE_LABELS } from '@/lib/types';

const MODEL_URLS = ['/models/showcase-a.glb', '/models/showcase-b.glb'];

/** Deterministic per-PC model pick: same PC always shows the same rig. */
function modelForPC(pcId: string): string {
  let hash = 0;
  for (let i = 0; i < pcId.length; i++) hash = (hash * 31 + pcId.charCodeAt(i)) | 0;
  return MODEL_URLS[Math.abs(hash) % MODEL_URLS.length];
}

/* ── palette per part type ─────────────────────────────────────────── */
const TYPE_COLORS: Record<PartType, string> = {
  cpu: '#22d3ee',
  gpu: '#a78bfa',
  ram: '#e879f9',
  psu: '#fbbf24',
  case: '#94a3b8',
  cooler: '#67e8f9',
  ssd: '#34d399',
  hdd: '#2dd4bf',
  mobo: '#60a5fa',
  fan: '#f472b6',
  other: '#fb7185',
};

/* pin height as a fraction of the model's height (0 = floor, 1 = top) */
const PIN_HEIGHTS: Record<PartType, number> = {
  case: 0.95,
  cooler: 0.85,
  cpu: 0.76,
  ram: 0.68,
  mobo: 0.58,
  fan: 0.5,
  gpu: 0.42,
  ssd: 0.32,
  hdd: 0.22,
  psu: 0.1, // SMPS — bottom compartment
  other: 0.62,
};

const FLOOR_Y = -1.28;
const MODEL_HEIGHT = 2.6;

/** Glowing callout pin with a permanent type label; full name on hover. */
function CalloutPin({
  part,
  position,
  towardCenter,
}: {
  part: Part;
  position: [number, number, number];
  towardCenter: number; // signed x-length of the leader line
}) {
  const { selectedPartId, select, hover } = useViewerStore();
  const [hovered, setHovered] = useState(false);
  const selected = selectedPartId === part.id;
  const color = TYPE_COLORS[part.type];
  const active = hovered || selected;
  const intensity = selected ? 3 : hovered ? 2 : 1.1;

  return (
    <group position={position}>
      {/* leader line into the chassis */}
      <mesh position={[towardCenter / 2, 0, 0]}>
        <boxGeometry args={[Math.abs(towardCenter), 0.008, 0.008]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.55}
        />
      </mesh>
      <mesh
        scale={selected ? 1.5 : hovered ? 1.25 : 1}
        onClick={(e) => {
          e.stopPropagation();
          select(selected ? null : part.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          hover(part.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          hover(null);
          document.body.style.cursor = '';
        }}
      >
        <octahedronGeometry args={[0.085]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={intensity}
          metalness={0.4}
          roughness={0.2}
        />
      </mesh>
      {/* always-on label: which part is which */}
      <Html center distanceFactor={7} position={[0, 0.19, 0]} zIndexRange={[10, 0]}>
        <button
          onClick={() => select(selected ? null : part.id)}
          className="whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-all"
          style={{
            borderColor: `${color}${active ? 'cc' : '55'}`,
            color,
            background: 'rgba(10,10,15,0.9)',
            boxShadow: active ? `0 0 12px ${color}66` : 'none',
          }}
        >
          {active ? `${part.brand} ${part.model}` : PART_TYPE_LABELS[part.type]}
        </button>
      </Html>
    </group>
  );
}

function ShowcaseModel({ url, parts }: { url: string; parts: Part[] }) {
  const { scene } = useGLTF(url, '/draco/');

  // normalize: any source scale/offset → height 2.6, feet on the floor disc
  const { scale, offset, halfWidth } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = MODEL_HEIGHT / (size.y || 1);
    return {
      scale: s,
      offset: [
        -center.x * s,
        FLOOR_Y - box.min.y * s,
        -center.z * s,
      ] as [number, number, number],
      halfWidth: Math.max((size.x * s) / 2, 0.7),
    };
  }, [scene]);

  // pins alternate left/right, tallest slots first, so labels never overlap
  const pins = useMemo(() => {
    const sorted = [...parts].sort(
      (a, b) => PIN_HEIGHTS[b.type] - PIN_HEIGHTS[a.type],
    );
    return sorted.map((part, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (halfWidth + 0.55);
      const y = FLOOR_Y + PIN_HEIGHTS[part.type] * MODEL_HEIGHT;
      return {
        part,
        position: [x, y, 0] as [number, number, number],
        towardCenter: -side * 0.5,
      };
    });
  }, [parts, halfWidth]);

  return (
    <group>
      <group scale={scale} position={offset}>
        <primitive object={scene} />
      </group>
      {pins.map(({ part, position, towardCenter }) => (
        <CalloutPin
          key={part.id}
          part={part}
          position={position}
          towardCenter={towardCenter}
        />
      ))}
    </group>
  );
}

for (const url of MODEL_URLS) useGLTF.preload(url, '/draco/');

function ModelLoadingHint() {
  return (
    <Html center>
      <p className="animate-pulse whitespace-nowrap font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan">
        streaming model…
      </p>
    </Html>
  );
}

function Scene({ parts, pcId }: { parts: Part[]; pcId: string }) {
  const autoRotate = useViewerStore((s) => s.autoRotate);
  const select = useViewerStore((s) => s.select);
  const url = useMemo(() => modelForPC(pcId), [pcId]);

  return (
    <>
      <color attach="background" args={['#0a0a0f']} />
      <ambientLight intensity={0.8} />
      <pointLight position={[4, 4, 4]} intensity={40} color="#22d3ee" />
      <pointLight position={[-4, 2, -3]} intensity={30} color="#a78bfa" />
      <pointLight position={[0, -2, 3]} intensity={15} color="#e879f9" />
      <directionalLight position={[2, 5, 3]} intensity={2.2} color="#ffffff" />

      <group onPointerMissed={() => select(null)}>
        <Suspense fallback={<ModelLoadingHint />}>
          <ShowcaseModel url={url} parts={parts} />
        </Suspense>
      </group>

      {/* floor disc + glow ring */}
      <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.6, 48]} />
        <meshStandardMaterial color="#0d0e16" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.45, 2.52, 64]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.6} />
      </mesh>

      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={0.7}
        enablePan={false}
        minDistance={3}
        maxDistance={9}
        maxPolarAngle={Math.PI / 1.9}
      />
      <EffectComposer>
        <Bloom intensity={0.45} luminanceThreshold={0.6} mipmapBlur radius={0.6} />
      </EffectComposer>
    </>
  );
}

export function PCViewer({ parts, pcId }: { parts: Part[]; pcId: string }) {
  return (
    <Canvas camera={{ position: [4.4, 2.0, 5.0], fov: 42 }} dpr={[1, 2]}>
      <Scene parts={parts} pcId={pcId} />
    </Canvas>
  );
}
