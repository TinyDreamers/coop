'use client';

import Link from 'next/link';
import { useProjectStore } from '@/lib/store/useProjectStore';
import {
  Card,
  CardBody,
  SectionTitle,
  Field,
  NumberField,
  Slider,
  Toggle,
  Segmented,
  Select,
  Button,
} from '@/components/ui';
import { WarningList } from '@/components/WarningList';
import { BudgetMeter } from '@/components/BudgetMeter';
import { RoofLayoutPicker } from '@/components/RoofLayoutPicker';
import { SIDING_OPTIONS, NESTING_BOX_OPTIONS } from '@/lib/constants';
import type { RoofMaterial } from '@/lib/types';
import { RotateCcw, Scaling } from 'lucide-react';

const ROOF_OPTIONS: { value: RoofMaterial; label: string }[] = [
  { value: 'corrugated-pvc', label: 'Corrugated PVC (clear)' },
  { value: 'corrugated-polycarbonate', label: 'Polycarbonate' },
  { value: 'corrugated-metal', label: 'Corrugated metal (cheapest)' },
];

export default function DesignPage() {
  const { project, computed, updateCoop, updateRun, updateOptions, reset } = useProjectStore();
  if (!project || !computed) return null;
  const { coop, run, options } = project;
  const { warnings, budget, metrics, geometry } = computed;
  const roofLayout = coop.roofLayout ?? 'length'; // older saved projects predate this field
  const isLength = roofLayout === 'length';

  function budgetFit() {
    // One-click "get closer to budget": shrink the run and use metal run roof.
    updateRun({ lengthFt: 16, roofMaterial: 'corrugated-metal' });
  }

  return (
    <div className="space-y-5">
      {/* Live summary */}
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-72">
            <BudgetMeter budget={budget} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={budgetFit}>
              <Scaling size={15} /> Budget-fit run
            </Button>
            <Button variant="ghost" onClick={() => reset()}>
              <RotateCcw size={15} /> Reset to recommended
            </Button>
          </div>
        </CardBody>
      </Card>

      {warnings.length > 0 && (
        <Card>
          <CardBody>
            <SectionTitle title="Live design checks" subtitle="Updates as you edit" />
            <WarningList warnings={warnings} />
          </CardBody>
        </Card>
      )}

      {/* Roof layout — the ONE continuous roofline, pick how it slopes */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Roof layout"
            subtitle={`One continuous roofline · ${metrics.roofPitch} pitch · ridge ${geometry.ridgeHeightFt.toFixed(1)} ft → eave ${geometry.eaveHeightFt.toFixed(1)} ft`}
          />
          <RoofLayoutPicker value={roofLayout} onChange={(v) => updateCoop({ roofLayout: v })} />
          <p className="mt-3 text-xs text-timber-500">
            Both are a single unbroken plane over the coop and run — no separate roofs, nothing pokes above the
            roofline. See it update live on the <Link href="/model" className="font-semibold text-blueprint-600">3D model</Link>.
          </p>
        </CardBody>
      </Card>

      {/* Flock */}
      <Card>
        <CardBody>
          <SectionTitle title="Flock" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Number of chickens">
              <NumberField value={options.chickens} onChange={(v) => updateOptions({ chickens: Math.max(1, Math.round(v)) })} min={1} suffix="birds" />
            </Field>
            <Field label="Bird size">
              <Segmented
                value={options.birdSize}
                onChange={(v) => updateOptions({ birdSize: v })}
                options={[
                  { value: 'bantam', label: 'Bantam' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'large', label: 'Large' },
                ]}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Coop dimensions */}
      <Card>
        <CardBody>
          <SectionTitle title="Coop" subtitle={`${metrics.coopAreaSqft} sq ft · one continuous roof @ ${metrics.roofPitch}`} />
          <div className="grid gap-4 sm:grid-cols-2">
            <DimField label="Width" value={coop.widthFt} onChange={(v) => updateCoop({ widthFt: v })} min={4} max={20} />
            <DimField label="Depth" value={coop.depthFt} onChange={(v) => updateCoop({ depthFt: v })} min={4} max={16} />
            <DimField label="Tall (ridge) wall" value={coop.frontWallHeightFt} onChange={(v) => updateCoop({ frontWallHeightFt: v })} min={6} max={14} step={0.5} />
            <DerivedField label={isLength ? 'Seam wall (derived)' : 'Low-side wall (derived)'} value={`${geometry.coopSeamWallFt.toFixed(1)} ft`} hint="Sits on the single roof plane — not editable" />
            <Field label="Roof material">
              <Select value={coop.roofMaterial} onChange={(v) => updateCoop({ roofMaterial: v })} options={ROOF_OPTIONS} />
            </Field>
            <Field label="Roof overhang">
              <NumberField value={coop.roofOverhangFt} onChange={(v) => updateCoop({ roofOverhangFt: v })} min={0} max={2} step={0.5} suffix="ft" />
            </Field>
            <Field label="Stud spacing">
              <Segmented value={String(coop.studSpacingIn)} onChange={(v) => updateCoop({ studSpacingIn: Number(v) })} options={[{ value: '16', label: '16" OC' }, { value: '24', label: '24" OC' }]} />
            </Field>
            <Field label="Rafter spacing">
              <Segmented value={String(coop.rafterSpacingIn)} onChange={(v) => updateCoop({ rafterSpacingIn: Number(v) })} options={[{ value: '16', label: '16" OC' }, { value: '24', label: '24" OC' }]} />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Siding" hint="Full comparison on the Siding screen">
              <Select value={coop.sidingOption} onChange={(v) => updateCoop({ sidingOption: v })} options={SIDING_OPTIONS.map((s) => ({ value: s.id, label: s.name }))} />
            </Field>
            <Field label="Vent length" hint={`~${metrics.actualVentSqft} sq ft of ${metrics.requiredVentSqft} sq ft target`}>
              <NumberField value={coop.ventLinearFt} onChange={(v) => updateCoop({ ventLinearFt: v })} min={0} max={40} suffix="ft" />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            <Toggle checked={coop.hasWinterVentFlap} onChange={(v) => updateCoop({ hasWinterVentFlap: v })} label="Closable winter vent flap" />
            <Toggle checked={coop.hasAutoChickenDoor} onChange={(v) => updateCoop({ hasAutoChickenDoor: v })} label="Automatic chicken door" />
          </div>
        </CardBody>
      </Card>

      {/* Run */}
      <Card>
        <CardBody>
          <SectionTitle title="Run" subtitle={`${metrics.runAreaSqft} sq ft · far (eave) wall ${geometry.eaveHeightFt.toFixed(1)} ft`} />
          <div className="grid gap-4 sm:grid-cols-2">
            <DimField label="Width" value={run.widthFt} onChange={(v) => updateRun({ widthFt: v })} min={4} max={20} />
            <DimField label="Length" value={run.lengthFt} onChange={(v) => updateRun({ lengthFt: v })} min={6} max={40} />
            <DerivedField label={isLength ? 'Coop-seam wall (derived)' : 'High-side wall (derived)'} value={`${geometry.runHighWallFt.toFixed(1)} ft`} hint="Sits on the single roof plane — not editable" />
            <DimField label="Far (low / eave) wall" value={run.wallHeightFt} onChange={(v) => updateRun({ wallHeightFt: v })} min={4} max={9} step={0.5} />
            <Field label="Roof material">
              <Select value={run.roofMaterial} onChange={(v) => updateRun({ roofMaterial: v })} options={ROOF_OPTIONS} />
            </Field>
            <Field label="Panel width" hint="Modular sections that unscrew to move">
              <Segmented value={String(run.panelWidthFt)} onChange={(v) => updateRun({ panelWidthFt: Number(v) })} options={[{ value: '4', label: '4 ft' }, { value: '6', label: '6 ft' }]} />
            </Field>
          </div>
          <div className="mt-4">
            <Toggle checked={run.hasHumanDoor} onChange={(v) => updateRun({ hasHumanDoor: v })} label="Walk-in human door into run" />
          </div>
        </CardBody>
      </Card>

      {/* Nesting */}
      <Card>
        <CardBody>
          <SectionTitle title="Nesting boxes" subtitle={`Need ${metrics.requiredNestingBoxes} for ${options.chickens} hens`} right={<Link href="/nesting" className="text-sm font-semibold text-blueprint-600">Compare →</Link>} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Number of boxes">
              <NumberField value={options.nestingBoxCount} onChange={(v) => updateOptions({ nestingBoxCount: Math.max(1, Math.round(v)) })} min={1} suffix="boxes" />
            </Field>
            <Field label="Type">
              <Select value={options.nestingBoxType} onChange={(v) => updateOptions({ nestingBoxType: v })} options={NESTING_BOX_OPTIONS.map((n) => ({ value: n.id, label: n.name }))} />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Predator-proofing */}
      <Card>
        <CardBody>
          <SectionTitle title="Predator-proofing" subtitle="Mandatory — the app warns on weak choices" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Run wire">
              <Select
                value={options.runWireType}
                onChange={(v) => updateOptions({ runWireType: v, wireType: v })}
                options={[
                  { value: 'hardware-cloth-half', label: '1/2" hardware cloth ✓' },
                  { value: 'hardware-cloth-quarter', label: '1/4" hardware cloth ✓' },
                  { value: 'welded-wire-1in', label: '1" welded wire ✕' },
                  { value: 'chicken-wire', label: 'Chicken wire ✕' },
                ]}
              />
            </Field>
            <Field label="Anti-dig protection">
              <Select
                value={options.antiDig}
                onChange={(v) => updateOptions({ antiDig: v })}
                options={[
                  { value: 'apron', label: 'Outward apron (recommended)' },
                  { value: 'buried', label: 'Buried skirt' },
                  { value: 'none', label: 'None ✕' },
                ]}
              />
            </Field>
            {options.antiDig === 'apron' && (
              <Field label="Apron width">
                <NumberField value={options.antiDigApronFt} onChange={(v) => updateOptions({ antiDigApronFt: v })} min={1} max={4} step={0.5} suffix="ft" />
              </Field>
            )}
            <Field label="Feeder mount">
              <Select
                value={options.feederMount}
                onChange={(v) => updateOptions({ feederMount: v })}
                options={[
                  { value: 'hanging-chain', label: 'Hanging chains' },
                  { value: 'feeder-rail', label: 'Feeder rail' },
                  { value: 'ground', label: 'On the ground (rat risk)' },
                ]}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Toggle checked={options.coveredRun} onChange={(v) => updateOptions({ coveredRun: v })} label="Fully covered run (solid roof)" />
          </div>
        </CardBody>
      </Card>

      {/* Electrical */}
      <Card>
        <CardBody>
          <SectionTitle title="Electrical" subtitle="Extension-cord setup, not hardwired" />
          <div className="flex flex-col gap-4">
            <Toggle checked={options.heatedWater} onChange={(v) => updateOptions({ heatedWater: v })} label="Heated water (winter)" />
            <Toggle checked={options.outdoorGfci} onChange={(v) => updateOptions({ outdoorGfci: v })} label="Outdoor GFCI protection" />
            <Toggle checked={options.futureLighting} onChange={(v) => updateOptions({ futureLighting: v })} label="Wire for future lighting (optional)" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/** A read-only companion to DimField for a value the single roof plane derives. */
function DerivedField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex h-[42px] items-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 text-sm font-semibold text-gray-600">
        {value}
      </div>
    </Field>
  );
}

function DimField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <Field label={`${label} (${value} ft)`}>
      <div className="flex items-center gap-3">
        <Slider value={value} onChange={onChange} min={min} max={max} step={step} />
        <div className="w-24 flex-shrink-0">
          <NumberField value={value} onChange={onChange} min={min} max={max} step={step} suffix="ft" />
        </div>
      </div>
    </Field>
  );
}
