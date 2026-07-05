'use client';

import { useMemo, useState } from 'react';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { Card, CardBody, SectionTitle, Badge, Button, ProgressBar, Stat, cn } from '@/components/ui';
import { num, pluralize } from '@/lib/format';
import type { BuildPhase } from '@/lib/types';
import {
  Check,
  ChevronDown,
  Clock,
  Wrench,
  Package,
  ShieldAlert,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';

/**
 * ===========================================================================
 * BUILD CHECKLIST
 *
 * A step-by-step, phone-in-hand build guide. It iterates the engine-generated
 * `computed.phases` (the 20 build phases) and lets the user tick off individual
 * steps. Progress is persisted in `project.checklist`, keyed by
 * `"<phase.id>:<stepIndex>"` — exactly the shape the store's
 * `toggleChecklistStep` / `setPhaseComplete` actions expect.
 *
 * Everything here is DERIVED read state + checklist writes; no design edits.
 * ===========================================================================
 */

/** Whether a single step (phase + index) is checked off. */
function isStepDone(checklist: Record<string, boolean>, phaseId: number, index: number): boolean {
  return !!checklist[`${phaseId}:${index}`];
}

/** Count of done steps within one phase. */
function phaseDoneCount(checklist: Record<string, boolean>, phase: BuildPhase): number {
  let done = 0;
  for (let i = 0; i < phase.steps.length; i++) {
    if (isStepDone(checklist, phase.id, i)) done++;
  }
  return done;
}

export default function ChecklistPage() {
  const { project, computed } = useProjectStore();

  const phases = computed?.phases ?? [];
  const checklist = project?.checklist ?? {};

  // Overall totals across every phase/step.
  const totals = useMemo(() => {
    let totalSteps = 0;
    let doneSteps = 0;
    let totalHours = 0;
    for (const p of phases) {
      totalSteps += p.steps.length;
      doneSteps += phaseDoneCount(checklist, p);
      totalHours += p.estimatedHours;
    }
    const pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
    return { totalSteps, doneSteps, totalHours, pct };
  }, [phases, checklist]);

  // Default the first *incomplete* phase open so the builder lands where they left off.
  const firstIncompletePhaseId = useMemo(() => {
    for (const p of phases) {
      if (phaseDoneCount(checklist, p) < p.steps.length) return p.id;
    }
    return phases.length > 0 ? phases[phases.length - 1].id : null;
    // Only recompute when the set/count of phases changes — NOT on every tick,
    // so ticking a box never yanks the open panel out from under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases.length]);

  const [openId, setOpenId] = useState<number | null>(firstIncompletePhaseId);

  if (!project || !computed) return null;

  const tone = totals.pct >= 100 ? 'moss' : totals.pct > 60 ? 'blueprint' : 'amber';

  return (
    <div className="space-y-4">
      {/* ---- Overall progress header ------------------------------------- */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Build checklist"
            subtitle={`${num(phases.length)} phases · tap any step to check it off as you go`}
          />

          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-bold text-timber-900">
                {num(totals.doneSteps)} of {num(totals.totalSteps)} steps
              </div>
              <div className="text-xs text-timber-500">
                {totals.pct}% complete
                {totals.pct >= 100 && ' — coop done, go get some chickens 🐔'}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-lg font-bold text-timber-900">
                <Clock size={16} className="text-timber-400" />
                {num(totals.totalHours)} hrs
              </div>
              <div className="text-xs text-timber-500">assumes you + one helper</div>
            </div>
          </div>

          <ProgressBar value={totals.pct} tone={tone} />

          {/* Quick stat strip */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Phases" value={num(phases.length)} />
            <Stat
              label="Steps left"
              value={num(totals.totalSteps - totals.doneSteps)}
              tone={totals.totalSteps - totals.doneSteps === 0 ? 'good' : 'default'}
            />
            <Stat label="Est. hours" value={num(totals.totalHours)} sub="+ 1 helper" />
          </div>
        </CardBody>
      </Card>

      {/* ---- Phase list -------------------------------------------------- */}
      <div className="space-y-2">
        {phases.map((phase) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            checklist={checklist}
            open={openId === phase.id}
            onToggleOpen={() => setOpenId((cur) => (cur === phase.id ? null : phase.id))}
          />
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// One collapsible phase
// ===========================================================================
function PhaseCard({
  phase,
  checklist,
  open,
  onToggleOpen,
}: {
  phase: BuildPhase;
  checklist: Record<string, boolean>;
  open: boolean;
  onToggleOpen: () => void;
}) {
  const { toggleChecklistStep, setPhaseComplete } = useProjectStore();

  const stepCount = phase.steps.length;
  const done = phaseDoneCount(checklist, phase);
  const allDone = stepCount > 0 && done === stepCount;
  const pct = stepCount > 0 ? (done / stepCount) * 100 : 0;

  return (
    <Card className={cn(allDone && 'border-moss-300 bg-moss-50/40')}>
      {/* Header — the whole bar is a big tap target that expands the phase. */}
      <button
        onClick={onToggleOpen}
        className="flex w-full items-center gap-3 p-3 text-left sm:p-4"
        aria-expanded={open}
      >
        {/* Phase number badge / done check */}
        <span
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold',
            allDone ? 'bg-moss-600 text-white' : 'bg-blueprint-100 text-blueprint-700',
          )}
        >
          {allDone ? <Check size={18} /> : phase.id}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-timber-900">{phase.title}</span>
            <Badge className="bg-timber-100 text-timber-600">
              <Clock size={11} /> {num(phase.estimatedHours)} hr
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-timber-200">
              <div
                className={cn('h-full rounded-full', allDone ? 'bg-moss-600' : 'bg-blueprint-600')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-timber-500">
              {done}/{stepCount} {pluralize(stepCount, 'step')}
            </span>
          </div>
        </div>

        <ChevronDown
          size={20}
          className={cn('flex-shrink-0 text-timber-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {/* Body — only mounted when expanded. */}
      {open && (
        <div className="space-y-4 border-t border-timber-100 p-3 sm:p-4">
          {/* Summary */}
          <p className="text-sm text-timber-700">{phase.summary}</p>

          {/* Tools + materials as chips */}
          {phase.tools.length > 0 && (
            <ChipGroup icon={<Wrench size={14} />} label="Tools" items={phase.tools} />
          )}
          {phase.materials.length > 0 && (
            <ChipGroup
              icon={<Package size={14} />}
              label="Materials needed"
              items={phase.materials}
            />
          )}

          {/* Bulk actions */}
          <div className="flex gap-2">
            <Button
              variant={allDone ? 'ghost' : 'primary'}
              onClick={() => setPhaseComplete(phase.id, stepCount, true)}
              disabled={allDone}
            >
              <Check size={15} /> Mark all done
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPhaseComplete(phase.id, stepCount, false)}
              disabled={done === 0}
            >
              Clear
            </Button>
          </div>

          {/* Steps */}
          <ol className="space-y-2">
            {phase.steps.map((step, i) => {
              const checked = isStepDone(checklist, phase.id, i);
              return (
                <li key={i}>
                  <button
                    onClick={() => toggleChecklistStep(`${phase.id}:${i}`)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      checked
                        ? 'border-moss-200 bg-moss-50'
                        : 'border-timber-200 bg-white hover:border-blueprint-300',
                    )}
                    aria-pressed={checked}
                  >
                    {/* Checkbox */}
                    <span
                      className={cn(
                        'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                        checked
                          ? 'border-moss-600 bg-moss-600 text-white'
                          : 'border-timber-300 bg-white',
                      )}
                    >
                      {checked && <Check size={16} strokeWidth={3} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'text-sm',
                          checked ? 'text-timber-500 line-through' : 'font-medium text-timber-900',
                        )}
                      >
                        <span className="mr-1 font-semibold text-timber-400">{i + 1}.</span>
                        {step.text}
                      </span>
                      {/* Inline safety note for the step (amber). */}
                      {step.safety && (
                        <span className="mt-1 flex items-start gap-1.5 text-xs font-medium text-amber-700">
                          <ShieldAlert size={13} className="mt-0.5 flex-shrink-0" />
                          {step.safety}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Common mistakes */}
          {phase.commonMistakes.length > 0 && (
            <div className="rounded-xl border border-timber-200 bg-timber-50 p-3">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-timber-800">
                <ListChecks size={15} className="text-timber-500" /> Common mistakes
              </div>
              <ul className="space-y-1">
                {phase.commonMistakes.map((m, i) => (
                  <li key={i} className="flex gap-2 text-sm text-timber-700">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-timber-400" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Safety notes */}
          {phase.safetyNotes.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle size={15} className="text-amber-600" /> Safety notes
              </div>
              <ul className="space-y-1">
                {phase.safetyNotes.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-amber-800">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-500" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ===========================================================================
// A labelled row of chips (tools / materials)
// ===========================================================================
function ChipGroup({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-timber-500">
        {icon} {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="rounded-full border border-timber-200 bg-white px-2.5 py-1 text-xs font-medium text-timber-700"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
