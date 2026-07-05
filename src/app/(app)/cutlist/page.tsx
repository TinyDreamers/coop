'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { Card, CardBody, SectionTitle, Button, EmptyState } from '@/components/ui';
import { exportCutListCsv } from '@/lib/csv';
import { inchesToFtIn, num, pluralize } from '@/lib/format';
import type { CutListItem } from '@/lib/types';
import { Scissors, Download, Printer } from 'lucide-react';

/**
 * Cut List screen.
 *
 * The engine produces `computed.cutList` — a flat list of every FINISHED cut
 * length needed for the build. This screen groups those cuts by build phase
 * (ascending) and presents each phase as a scrollable table (desktop) / stacked
 * cards (mobile). It is the "at the saw" companion to the Materials screen:
 * Materials tells you how many boards to BUY (with waste), this tells you what
 * lengths to cut them into.
 *
 * Loading is handled by AppShell, so we bail to null until the store is ready.
 */
export default function CutListPage() {
  const { project, computed } = useProjectStore();

  const cutList = computed?.cutList ?? [];

  // Group cuts by phase, ascending. Memoized so we only regroup when the
  // computed cut list actually changes.
  const phases = useMemo(() => groupByPhase(cutList), [cutList]);

  // Total finished pieces = sum of every cut's quantity across all phases.
  const totalPieces = useMemo(
    () => cutList.reduce((sum, c) => sum + c.quantity, 0),
    [cutList],
  );

  if (!project || !computed) return null;

  return (
    <div className="space-y-4">
      {/* ---- Summary + actions ---- */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Cut list"
            subtitle={`${num(totalPieces)} finished ${pluralize(totalPieces, 'piece')} across ${phases.length} ${pluralize(phases.length, 'phase')}`}
            right={
              <div className="flex flex-shrink-0 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => exportCutListCsv(computed)}
                  disabled={cutList.length === 0}
                >
                  <Download size={15} /> Export CSV
                </Button>
                <Link href="/print" className="btn-primary text-sm">
                  <Printer size={15} /> Printable plan
                </Link>
              </div>
            }
          />
          <p className="text-sm text-timber-600">
            These are the <b>finished cut lengths</b> for every board. Quantities to{' '}
            <b>buy</b> — including waste overage and whole boards — live on the{' '}
            <Link href="/materials" className="font-semibold text-blueprint-600 underline">
              Materials
            </Link>{' '}
            screen. Measure twice, cut once.
          </p>
        </CardBody>
      </Card>

      {/* ---- Empty state ---- */}
      {cutList.length === 0 ? (
        <EmptyState icon={<Scissors size={28} />} title="No cuts yet">
          Once your design produces framing lumber, every finished cut length will
          be listed here, grouped by build phase.
        </EmptyState>
      ) : (
        // ---- Per-phase groups ----
        <div className="space-y-4">
          {phases.map((group) => (
            <PhaseGroup key={group.phase} phase={group.phase} items={group.items} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase grouping helper
// ---------------------------------------------------------------------------

interface PhaseGroupData {
  phase: number;
  items: CutListItem[];
}

/** Bucket cut items by their `phase`, returning groups sorted ascending. */
function groupByPhase(items: CutListItem[]): PhaseGroupData[] {
  const map = new Map<number, CutListItem[]>();
  for (const item of items) {
    const bucket = map.get(item.phase);
    if (bucket) bucket.push(item);
    else map.set(item.phase, [item]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([phase, groupItems]) => ({ phase, items: groupItems }));
}

// ---------------------------------------------------------------------------
// Phase group — one header + a responsive table / card list
// ---------------------------------------------------------------------------

function PhaseGroup({ phase, items }: { phase: number; items: CutListItem[] }) {
  const pieces = items.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <Card>
      <div className="border-b border-timber-100 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-timber-900">Phase {phase}</h3>
          <span className="text-xs font-semibold text-timber-500">
            {num(pieces)} {pluralize(pieces, 'piece')}
          </span>
        </div>
      </div>

      {/* Desktop: horizontally-scrollable table. Hidden on small screens. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-timber-100 text-left text-xs font-semibold uppercase tracking-wide text-timber-500">
              <th className="px-5 py-2">Part</th>
              <th className="px-5 py-2">Stock</th>
              <th className="px-5 py-2">Length</th>
              <th className="px-5 py-2 text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-timber-50 last:border-0 align-top">
                <td className="px-5 py-2.5 font-medium text-timber-900">
                  {item.part}
                  {item.angleNote && (
                    <span className="mt-0.5 block text-xs italic text-amber-700">
                      {item.angleNote}
                    </span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-timber-600">{item.stock}</td>
                <td className="px-5 py-2.5 font-semibold tabular-nums text-timber-900">
                  {inchesToFtIn(item.lengthIn)}
                </td>
                <td className="px-5 py-2.5 text-right font-bold tabular-nums text-timber-900">
                  {num(item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards. Shown only on small screens. */}
      <ul className="divide-y divide-timber-100 sm:hidden">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-timber-900">{item.part}</div>
                <div className="mt-0.5 text-xs text-timber-500">{item.stock}</div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="font-bold tabular-nums text-timber-900">
                  {inchesToFtIn(item.lengthIn)}
                </div>
                <div className="text-xs text-timber-500">
                  ×{num(item.quantity)}
                </div>
              </div>
            </div>
            {item.angleNote && (
              <p className="mt-1.5 text-xs italic text-amber-700">{item.angleNote}</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
