'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { Card, CardBody, Toggle, Slider, Badge, cn, Spinner, Button } from '@/components/ui';
import { money } from '@/lib/format';
import type { ComponentLayer } from '@/lib/types';
import { Boxes, Eye, Rotate3d, Ruler, Info } from 'lucide-react';

// R3F must render client-only — no SSR.
const CoopModel = dynamic(() => import('@/components/three/CoopModel'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  ),
});

const LAYERS: { id: ComponentLayer; label: string; color: string }[] = [
  { id: 'framing', label: 'Framing', color: '#caa26a' },
  { id: 'siding', label: 'Siding', color: '#d8c39a' },
  { id: 'roofing', label: 'Roofing', color: '#9db9cc' },
  { id: 'hardware-cloth', label: 'Hardware cloth', color: '#64748b' },
  { id: 'fixtures', label: 'Fixtures', color: '#8f6539' },
];

const SUPPLY_STYLE: Record<string, string> = {
  purchased: 'bg-blueprint-50 text-blueprint-700',
  'owner-supplied': 'bg-moss-100 text-moss-700',
  optional: 'bg-amber-100 text-amber-700',
};

export default function ModelPage() {
  const { computed } = useProjectStore();
  const [visibleLayers, setVisibleLayers] = useState<Set<ComponentLayer>>(
    new Set(['framing', 'siding', 'roofing', 'hardware-cloth', 'fixtures']),
  );
  const [showCoop, setShowCoop] = useState(true);
  const [showRun, setShowRun] = useState(true);
  const [explode, setExplode] = useState(0);
  const [showDims, setShowDims] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!computed) return null;
  const selected = computed.components.find((c) => c.id === selectedId) ?? null;

  function toggleLayer(id: ComponentLayer) {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-timber-900">3D Model</h1>
          <p className="text-sm text-timber-600">Tap any part to inspect it. Drag to orbit, pinch/scroll to zoom.</p>
        </div>
        <Badge className="bg-timber-100 text-timber-600">
          <Boxes size={13} /> {computed.components.length} parts
        </Badge>
      </div>

      {/* Viewer */}
      <Card className="overflow-hidden">
        <div className="h-[52vh] min-h-[340px] w-full sm:h-[58vh]">
          <CoopModel
            components={computed.components}
            visibleLayers={visibleLayers}
            showCoop={showCoop}
            showRun={showRun}
            explode={explode}
            showDims={showDims}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </Card>

      {/* Inspector */}
      {selected ? (
        <Card className="border-blueprint-300">
          <CardBody>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-timber-900">{selected.name}</h2>
                  <Badge className={cn(SUPPLY_STYLE[selected.supply])}>{selected.supply.replace('-', ' ')}</Badge>
                </div>
                <p className="text-xs uppercase tracking-wide text-timber-500">
                  {selected.structure} · {selected.group.replace('-', ' ')}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedId(null)} className="-mr-2 px-2">
                ✕
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Info2 label="Material" value={selected.material} />
              <Info2 label="Dimensions" value={selected.dimensions} />
              <Info2 label="Quantity" value={`${selected.quantity}`} />
              <Info2 label="Est. cost" value={money(selected.estimatedCost)} />
              <Info2 label="Build phase" value={`Phase ${selected.phase}`} />
              {selected.homeDepotSku && <Info2 label="Home Depot SKU" value={selected.homeDepotSku} />}
            </div>
            {selected.cutInstructions && (
              <p className="mt-3 rounded-lg bg-timber-50 p-2 text-sm text-timber-700">
                <span className="font-semibold">Cut / install: </span>
                {selected.cutInstructions}
              </p>
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-timber-300 bg-white/60 p-3 text-sm text-timber-500">
          <Info size={16} /> Select a component in the model to see its material, dimensions, quantity, cost, and cut notes.
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardBody className="space-y-4">
          <div>
            <div className="label flex items-center gap-1">
              <Eye size={13} /> Structures
            </div>
            <div className="flex gap-4">
              <Toggle checked={showCoop} onChange={setShowCoop} label="Coop" />
              <Toggle checked={showRun} onChange={setShowRun} label="Run" />
            </div>
          </div>

          <div>
            <div className="label">Layers</div>
            <div className="flex flex-wrap gap-2">
              {LAYERS.map((l) => {
                const on = visibleLayers.has(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggleLayer(l.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                      on ? 'border-timber-400 bg-white text-timber-800' : 'border-timber-200 bg-timber-50 text-timber-400',
                    )}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: l.color, opacity: on ? 1 : 0.4 }} />
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="label flex items-center gap-1">
                <Rotate3d size={13} /> Exploded view
              </div>
              <Slider value={explode} onChange={setExplode} min={0} max={1} step={0.05} />
            </div>
            <div className="flex items-end">
              <Toggle checked={showDims} onChange={setShowDims} label="Show dimensions" />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Info2({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-timber-500">{label}</div>
      <div className="break-words font-medium text-timber-900">{value}</div>
    </div>
  );
}
