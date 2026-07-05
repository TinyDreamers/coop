'use client';

import { useProjectStore } from '@/lib/store/useProjectStore';
import { Card, CardBody, SectionTitle, Badge, Button, Stat, cn } from '@/components/ui';
import { money, pluralize } from '@/lib/format';
import { NESTING_BOX_OPTIONS } from '@/lib/constants';
import type { NestingBoxOption } from '@/lib/types';
import { Check, Egg, Sparkles, Hammer, AlertTriangle } from 'lucide-react';

/**
 * ===========================================================================
 * NESTING BOX COMPARISON
 *
 * Side-by-side comparison of the three nesting-box strategies from the static
 * catalog (NESTING_BOX_OPTIONS). Mirrors the materials screen: read design
 * state + actions from the single Zustand store, render nothing until the
 * project + computed bundle are ready (AppShell shows the loader), and write
 * the user's choice straight back with updateOptions.
 *
 * The engine derives `requiredNestingBoxes` from the flock size, so we compare
 * that against the user's chosen box count and flag a shortfall inline.
 * ===========================================================================
 */

// Human-readable labels for the enum-ish rating fields on each option.
const CLEANLINESS_LABEL: Record<NestingBoxOption['eggCleanliness'], string> = {
  standard: 'Standard',
  high: 'High',
  highest: 'Highest',
};
const CLEANLINESS_TONE: Record<NestingBoxOption['eggCleanliness'], string> = {
  standard: 'bg-slate-100 text-slate-600',
  high: 'bg-moss-100 text-moss-700',
  highest: 'bg-moss-100 text-moss-700',
};

const EFFORT_LABEL: Record<NestingBoxOption['effort'], string> = {
  low: 'Low build effort',
  medium: 'Medium build effort',
  high: 'High build effort',
};
const EFFORT_TONE: Record<NestingBoxOption['effort'], string> = {
  low: 'bg-moss-100 text-moss-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-amber-100 text-amber-700',
};

export default function NestingPage() {
  const { project, computed, updateOptions } = useProjectStore();
  if (!project || !computed) return null;

  const boxCount = project.options.nestingBoxCount;
  const selectedType = project.options.nestingBoxType;
  const required = computed.metrics.requiredNestingBoxes;
  const shortfall = boxCount < required;

  return (
    <div className="space-y-4">
      {/* Intro / explainer -------------------------------------------------- */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Nesting boxes"
            subtitle="Compare build strategies and pick what your hens lay in"
          />
          <p className="text-sm text-timber-600">
            <b>Outside-access boxes</b> hang off the back wall with a lift-up lid, so you can
            collect eggs without ever stepping into the coop. Pair that with{' '}
            <b>roll-away floors</b> — the box floor is gently angled so a freshly laid egg rolls
            forward into a shaded collection tray. Hens can&apos;t sit on, soil, peck, or break
            eggs they can&apos;t reach, which means cleaner eggs and far less waste.
          </p>
          <p className="mt-2 text-sm text-timber-600">
            Plan roughly <b>one box per 3–4 hens</b>. They&apos;ll happily share, so more boxes
            than required is fine — too few just means crowding, cracked eggs, and squabbles.
          </p>

          {/* Current count vs. engine-required count */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat
              label="Planned boxes"
              value={boxCount}
              sub={`${pluralize(boxCount, 'box', 'boxes')} in your design`}
              tone={shortfall ? 'warn' : 'default'}
            />
            <Stat
              label="Recommended"
              value={required}
              sub={`for ${project.options.chickens} ${pluralize(project.options.chickens, 'hen')}`}
              tone={shortfall ? 'bad' : 'good'}
            />
          </div>

          {/* Inline shortfall warning (matches WarningList styling) */}
          {shortfall && (
            <div className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div className="text-sm">
                <div className="font-semibold text-timber-900">
                  You&apos;re {required - boxCount} {pluralize(required - boxCount, 'box', 'boxes')} short
                </div>
                <p className="mt-0.5 text-timber-700">
                  {boxCount} {pluralize(boxCount, 'box', 'boxes')} for {project.options.chickens} hens
                  crowds the flock. Bump the box count to at least {required} on the Design screen.
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Comparison grid: 1 col on mobile, 3 across on large screens --------- */}
      <div className="grid gap-3 lg:grid-cols-3">
        {NESTING_BOX_OPTIONS.map((option) => (
          <NestingCard
            key={option.id}
            option={option}
            boxCount={boxCount}
            selected={option.id === selectedType}
            onSelect={() => updateOptions({ nestingBoxType: option.id })}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A single comparison card. The currently-selected type is highlighted with a
 * blueprint ring + "Selected" badge; the engine's recommended pick gets a
 * "Recommended" badge. The flock total scales the per-box cost by the planned
 * box count so users see the real dollar impact of the choice.
 */
function NestingCard({
  option,
  boxCount,
  selected,
  onSelect,
}: {
  option: NestingBoxOption;
  boxCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const flockTotal = option.costPerBox * boxCount;

  return (
    <Card
      className={cn(
        'flex flex-col transition-shadow',
        // Highlight the active choice with a blueprint ring.
        selected && 'ring-2 ring-blueprint-500 ring-offset-1',
      )}
    >
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Header: name + status badges */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-timber-900">{option.name}</h3>
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            {selected && (
              <Badge className="bg-blueprint-600 text-white">
                <Check size={12} /> Selected
              </Badge>
            )}
            {option.recommended && (
              <Badge className="bg-moss-100 text-moss-700">
                <Sparkles size={12} /> Recommended
              </Badge>
            )}
          </div>
        </div>

        {/* Pricing: per box + scaled flock total */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-timber-900">{money(option.costPerBox)}</span>
          <span className="text-sm text-timber-500">/ box</span>
        </div>
        <div className="mt-0.5 text-sm text-timber-600">
          <b className="text-timber-800">{money(flockTotal)}</b> for {boxCount}{' '}
          {pluralize(boxCount, 'box', 'boxes')}
        </div>

        {/* Rating chips: cleanliness + effort */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className={CLEANLINESS_TONE[option.eggCleanliness]}>
            <Egg size={12} /> {CLEANLINESS_LABEL[option.eggCleanliness]} cleanliness
          </Badge>
          <Badge className={EFFORT_TONE[option.effort]}>
            <Hammer size={12} /> {EFFORT_LABEL[option.effort]}
          </Badge>
        </div>

        {/* Pros — green check bullets */}
        <div className="mt-4">
          <div className="label">Pros</div>
          <ul className="mt-1 space-y-1.5">
            {option.pros.map((pro) => (
              <li key={pro} className="flex gap-2 text-sm text-timber-700">
                <Check size={16} className="mt-0.5 flex-shrink-0 text-moss-600" />
                <span>{pro}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cons — plain dash bullets */}
        <div className="mt-3">
          <div className="label">Cons</div>
          <ul className="mt-1 space-y-1.5">
            {option.cons.map((con) => (
              <li key={con} className="flex gap-2 text-sm text-timber-600">
                <span className="mt-0.5 flex-shrink-0 font-bold text-timber-400" aria-hidden>
                  –
                </span>
                <span>{con}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* "Use this" action pinned to the bottom of the card */}
        <div className="mt-5 pt-1">
          <Button
            variant={selected ? 'secondary' : 'primary'}
            className="w-full"
            onClick={onSelect}
            disabled={selected}
          >
            {selected ? 'Selected' : 'Use this'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
