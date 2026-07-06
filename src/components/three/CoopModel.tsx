'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Edges, Grid } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Component3D, ComponentLayer } from '@/lib/types';

/**
 * Interactive parametric 3D model of the coop + run. Renders each build
 * component as a clickable box with inspector metadata. Supports layer/structure
 * toggles, an exploded view, dimension labels, and selection highlighting.
 *
 * 1 world unit = 1 foot. The scene is Y-up. This is intentionally schematic
 * (boxes, not CAD) but dimensionally accurate enough to understand the build.
 */

export interface ModelViewProps {
  components: Component3D[];
  visibleLayers: Set<ComponentLayer>;
  showCoop: boolean;
  showRun: boolean;
  explode: number; // 0..1
  showDims: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** Bounding-box center of all components (used for exploded offset + camera). */
function useSceneBounds(components: Component3D[]) {
  return useMemo(() => {
    const box = new THREE.Box3();
    const finite = components.filter(
      (c) => c.position.every(Number.isFinite) && c.size.every(Number.isFinite),
    );
    if (finite.length === 0) box.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 5, 5));
    for (const c of finite) {
      const half = new THREE.Vector3(c.size[0] / 2, c.size[1] / 2, c.size[2] / 2);
      const pos = new THREE.Vector3(...c.position);
      box.expandByPoint(pos.clone().sub(half));
      box.expandByPoint(pos.clone().add(half));
    }
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    return { center, radius: Math.max(size.x, size.y, size.z) };
  }, [components]);
}

function Part({
  c,
  center,
  explode,
  selected,
  onSelect,
}: {
  c: Component3D;
  center: THREE.Vector3;
  explode: number;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  // Exploded offset: push each part outward from the scene center.
  const pos = useMemo(() => {
    const base = new THREE.Vector3(...c.position);
    if (explode <= 0) return base;
    const dir = base.clone().sub(center);
    if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
    dir.normalize();
    return base.add(dir.multiplyScalar(explode * 8));
  }, [c.position, center, explode]);

  const isThin = Math.min(...c.size) < 0.12;
  const opacity = selected ? 1 : c.opacity ?? 1;

  // Never feed NaN geometry to three.js (e.g. from a cleared dimension field).
  if (![...pos.toArray(), ...c.size].every(Number.isFinite)) return null;

  return (
    <mesh
      position={pos.toArray()}
      rotation={c.rotation ?? [0, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(selected ? null : c.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[Math.max(c.size[0], 0.02), Math.max(c.size[1], 0.02), Math.max(c.size[2], 0.02)]} />
      <meshStandardMaterial
        color={selected ? '#1f63eb' : c.color}
        transparent={opacity < 1}
        opacity={opacity}
        emissive={selected ? '#1f63eb' : '#000000'}
        emissiveIntensity={selected ? 0.35 : 0}
        roughness={0.8}
        metalness={0.05}
        polygonOffset={isThin}
        polygonOffsetFactor={-1}
      />
      {selected && <Edges scale={1.02} color="#1c3a8a" />}
    </mesh>
  );
}

function Scene({
  components,
  visibleLayers,
  showCoop,
  showRun,
  explode,
  showDims,
  selectedId,
  onSelect,
}: ModelViewProps) {
  const { center, radius } = useSceneBounds(components);

  const visible = components.filter(
    (c) =>
      visibleLayers.has(c.layer) &&
      ((c.structure === 'coop' && showCoop) || (c.structure === 'run' && showRun)),
  );

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[center.x + 20, 30, center.z + 15]} intensity={1.1} castShadow />
      <directionalLight position={[center.x - 15, 20, center.z - 20]} intensity={0.4} />

      {/* Ground grid */}
      <Grid
        position={[center.x, 0, center.z]}
        args={[radius * 3, radius * 3]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#c9b997"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#a97d47"
        fadeDistance={radius * 4}
        infiniteGrid={false}
      />

      {/* Click empty space to deselect */}
      <mesh position={[center.x, -0.02, center.z]} rotation={[-Math.PI / 2, 0, 0]} onClick={() => onSelect(null)}>
        <planeGeometry args={[radius * 3, radius * 3]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {visible.map((c) => (
        <Part key={c.id} c={c} center={center} explode={explode} selected={selectedId === c.id} onSelect={onSelect} />
      ))}

      {showDims && (
        // Measure only the visible parts so callouts match what's shown.
        <DimensionLabels components={visible} showCoop={showCoop} showRun={showRun} />
      )}

      <OrbitControls
        target={[center.x, center.y * 0.6, center.z]}
        makeDefault
        enableDamping
        dampingFactor={0.1}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={6}
        maxDistance={radius * 4}
      />
    </>
  );
}

/** A few overall dimension callouts using HTML billboards. */
function DimensionLabels({
  components,
  showCoop,
  showRun,
}: {
  components: Component3D[];
  showCoop: boolean;
  showRun: boolean;
}) {
  const label = (text: string, pos: [number, number, number], key: string) => (
    <Html key={key} position={pos} center distanceFactor={30}>
      <div className="whitespace-nowrap rounded bg-timber-900/90 px-2 py-0.5 text-xs font-semibold text-white shadow">
        {text}
      </div>
    </Html>
  );

  const coop = components.filter((c) => c.structure === 'coop');
  const run = components.filter((c) => c.structure === 'run');
  const bounds = (list: Component3D[]) => {
    const box = new THREE.Box3();
    for (const c of list) {
      const half = new THREE.Vector3(c.size[0] / 2, c.size[1] / 2, c.size[2] / 2);
      const p = new THREE.Vector3(...c.position);
      box.expandByPoint(p.clone().sub(half));
      box.expandByPoint(p.clone().add(half));
    }
    return box;
  };

  const out: React.ReactNode[] = [];
  if (showCoop && coop.length) {
    const b = bounds(coop);
    const s = new THREE.Vector3();
    b.getSize(s);
    out.push(label(`Coop ${Math.round(s.x)}′ × ${Math.round(s.z)}′`, [(b.min.x + b.max.x) / 2, b.max.y + 1, b.min.z], 'coop-dim'));
  }
  if (showRun && run.length) {
    const b = bounds(run);
    const s = new THREE.Vector3();
    b.getSize(s);
    out.push(label(`Run ${Math.round(s.x)}′ × ${Math.round(s.z)}′`, [(b.min.x + b.max.x) / 2, b.max.y + 1, (b.min.z + b.max.z) / 2], 'run-dim'));
  }
  return <>{out}</>;
}

export default function CoopModel(props: ModelViewProps) {
  const { center, radius } = useSceneBounds(props.components);
  const camRef = useRef<[number, number, number]>([
    center.x + radius * 1.3,
    radius * 1.1,
    center.z + radius * 1.5,
  ]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: camRef.current, fov: 45, near: 0.1, far: 1000 }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#f2ebdf']} />
      <Scene {...props} />
    </Canvas>
  );
}
