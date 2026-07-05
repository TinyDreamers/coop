'use client';

import { useMemo } from 'react';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { Card, CardBody, SectionTitle, Badge, Button, cn } from '@/components/ui';
import { money, pluralize } from '@/lib/format';
import { SIDING_OPTIONS } from '@/lib/constants';
import type { SidingOption } from '@/lib/types';
import { Check, X, Star, ShieldCheck, Layers } from 'lucide-react';

/**
 * SIDING COMPARISON SCREEN
 *
 * Side-by-side cards for the exterior-siding choices in SIDING_OPTIONS. The
 * cheapest sheet is not always the cheapest coop: durability, edge sealing, and
 * paint all matter — so each card shows sheet price, an estimated coop total,
 * durability, pros, cons, and any extra material notes.
 *
 * IMPORTANT: siding is a comfort/longevity choice, NOT a security choice.
 * Predator-proofing lives entirely in the framing + hardware cloth and is never
 * traded away for a cheaper wall. The banner below makes that explicit.
 */
export default function SidingPage() {
  const { project, computed, updateCoop } = useProjectStore();

  // Number of 4x8 sheets the engine sized for the coop walls. We prefer the
  // real computed material line (already accounts for waste + wall area); if the
  // selected option's material line isn't present for any reason, fall back to a
  // simple wall-area / 32 sq-ft-per-sheet estimate so the card still shows a
  // sensible "~N sheets" total. (This is derived from the CURRENT design, so the
  // sheet count is identical across every option — the walls don't change.)
  const sheetsNeeded = useMemo(() => {
    if (!computed) return 0;
    const selectedId = project?.coop.sidingOption;
    const selectedOption = SIDING_OPTIONS.find((o) => o.id === selectedId);
    const line = selectedOption
      ? computed.materials.find((m) => m.id === selectedOption.materialId)
      : undefined;
    if (line && line.qty > 0) return line.qty;
    return Math.max(1, Math.ceil(computed.geometry.coopWallAreaSqft / 32));
  }, [project?.coop.sidingOption, computed]);

  // Loading is handled by AppShell; bail until the project + derived bundle exist.
  if (!project || !computed) return null;

  const selectedId = project.coop.sidingOption;
  const wallSqft = Math.round(computed.geometry.coopWallAreaSqft);

  return (
    <div className="space-y-4">
      {/* Intro */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Siding comparison"
            subtitle={`~${wallSqft} sq ft of wall · about ${sheetsNeeded} ${pluralize(sheetsNeeded, 'sheet')} either way`}
          />
          <p className="text-sm text-timber-600">
            All four options cover the same walls, so the sheet count is the same — the difference is
            up-front cost, how long the finish lasts, and how much prep (paint, wrap, edge sealing) each
            one needs. Pick the one that fits your budget and how long you want to go before re-cladding.
          </p>
        </CardBody>
      </Card>

      {/* Security reassurance — siding is never a predator-proofing compromise. */}
      <div className="flex items-start gap-3 rounded-xl border border-moss-200 bg-moss-50 p-4">
        <ShieldCheck className="mt-0.5 h-6 w-6 flex-shrink-0 text-moss-600" />
        <div>
          <div className="font-semibold text-moss-700">Predator-proofing is never the cost trade-off</div>
          <div className="text-sm text-moss-600">
            Security comes from the framing, hardware cloth, and latches — not the siding. Even the
            budget wall keeps every animal out. Cheaper siding only means more paint or an earlier
            re-clad down the road, never a weaker coop.
          </div>
        </div>
      </div>

      {/* Comparison cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {SIDING_OPTIONS.map((option) => (
          <SidingCard
            key={option.id}
            option={option}
            sheetsNeeded={sheetsNeeded}
            selected={option.id === selectedId}
            onSelect={() => updateCoop({ sidingOption: option.id })}
          />
        ))}
      </div>

      <p className="px-1 text-xs text-timber-500">
        Estimated coop total = sheet price × ~{sheetsNeeded} {pluralize(sheetsNeeded, 'sheet')}. This is
        the siding sheets only — paint, house wrap, trim, and fasteners are counted separately on the
        Materials screen. Changing your selection updates the material list and budget automatically.
      </p>
    </div>
  );
}

/**
 * A single siding option rendered as a comparison card. The selected option gets
 * a blueprint border + "Selected" pill; every other option shows a "Use this"
 * button that writes the choice back to the design.
 */
function SidingCard({
  option,
  sheetsNeeded,
  selected,
  onSelect,
}: {
  option: SidingOption;
  sheetsNeeded: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const coopTotal = sheetsNeeded * option.sheetPrice;

  return (
    <Card
      className={cn(
        'flex flex-col transition-colors',
        // Highlight the active choice with the blueprint accent + ring.
        selected && 'border-blueprint-500 ring-2 ring-blueprint-500/40',
      )}
    >
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Header: name + status/recommended badges */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold leading-tight text-timber-900">{option.name}</h3>
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            {selected && (
              <Badge className="bg-blueprint-600 text-white">
                <Check size={12} /> Selected
              </Badge>
            )}
            {option.recommended && (
              <Badge className="bg-amber-100 text-amber-700">
                <Star size={12} /> Recommended
              </Badge>
            )}
          </div>
        </div>

        {/* Pricing: per-sheet + estimated coop total */}
        <div className="mt-3 flex items-end justify-between gap-3 rounded-xl border border-timber-200 bg-timber-50 p-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-timber-500">Per sheet</div>
            <div className="text-lg font-bold text-timber-900">{money(option.sheetPrice)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-timber-500">
              Est. coop siding
            </div>
            <div className="text-xl font-bold text-blueprint-700">{money(coopTotal)}</div>
            <div className="text-xs text-timber-500">
              ~{sheetsNeeded} {pluralize(sheetsNeeded, 'sheet')}
            </div>
          </div>
        </div>

        {/* Durability */}
        <div className="mt-3 flex items-center gap-2 text-sm text-timber-700">
          <Layers size={15} className="flex-shrink-0 text-timber-400" />
          <span className="font-semibold text-timber-800">Lasts:</span>
          <span>{option.durabilityYears}</span>
        </div>

        {/* Pros (green) + cons (muted with red marks) */}
        <div className="mt-3 space-y-2">
          <ul className="space-y-1">
            {option.pros.map((pro) => (
              <li key={pro} className="flex gap-2 text-sm text-timber-700">
                <Check size={16} className="mt-0.5 flex-shrink-0 text-moss-600" />
                <span>{pro}</span>
              </li>
            ))}
          </ul>
          <ul className="space-y-1">
            {option.cons.map((con) => (
              <li key={con} className="flex gap-2 text-sm text-timber-600">
                <X size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                <span>{con}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Extra prep note (paint / wrap / trim) */}
        {option.extraNote && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            {option.extraNote}
          </p>
        )}

        {/* Action — pushed to the bottom so cards line up in the grid */}
        <div className="mt-4 flex-1" />
        {selected ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-blueprint-200 bg-blueprint-50 py-2.5 text-sm font-semibold text-blueprint-700">
            <Check size={16} /> Selected for your build
          </div>
        ) : (
          <Button variant="primary" className="w-full" onClick={onSelect}>
            Use this
          </Button>
        )}
      </div>
    </Card>
  );
}
