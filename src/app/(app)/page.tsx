'use client';

import Link from 'next/link';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { Card, CardBody, Stat, SectionTitle, Button, ProgressBar } from '@/components/ui';
import { WarningList } from '@/components/WarningList';
import { BudgetMeter } from '@/components/BudgetMeter';
import { money } from '@/lib/format';
import { SQFT_PER_BIRD_COOP, SQFT_PER_BIRD_RUN } from '@/lib/constants';
import {
  SlidersHorizontal,
  Box,
  ShoppingCart,
  Hammer,
  ArrowRight,
  Lightbulb,
  Ruler,
} from 'lucide-react';

export default function DashboardPage() {
  const { project, computed } = useProjectStore();
  if (!project || !computed) return null;

  const { metrics, budget, warnings, phases } = computed;

  // Build-checklist progress. Count only steps that exist in the CURRENT phases
  // (a design change can leave stale checklist keys behind), so we never exceed 100%.
  const totalSteps = phases.reduce((n, p) => n + p.steps.length, 0);
  const doneSteps = phases.reduce(
    (n, p) => n + p.steps.filter((_, i) => project.checklist[`${p.id}:${i}`]).length,
    0,
  );
  const progress = totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0;

  const errors = warnings.filter((w) => w.severity === 'error');
  const nonErrors = warnings.filter((w) => w.severity !== 'error');

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-timber-800 to-timber-600 p-5 text-white shadow-card sm:p-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="mt-1 max-w-xl text-sm text-timber-100">
              {project.options.chickens} large-breed birds · {metrics.coopAreaSqft} sq ft walk-in coop +{' '}
              {metrics.runAreaSqft} sq ft covered run · {project.settings.storeArea}
            </p>
          </div>
          <Link href="/design" className="btn flex-shrink-0 bg-white/15 text-white hover:bg-white/25">
            <SlidersHorizontal size={16} /> Edit design
          </Link>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Coop / bird"
          value={`${metrics.coopAreaPerBird} sf`}
          sub={`target ${SQFT_PER_BIRD_COOP} sf`}
          tone={metrics.coopAreaPerBird >= SQFT_PER_BIRD_COOP ? 'good' : 'bad'}
        />
        <Stat
          label="Run / bird"
          value={`${metrics.runAreaPerBird} sf`}
          sub={`target ${SQFT_PER_BIRD_RUN} sf`}
          tone={metrics.runAreaPerBird >= SQFT_PER_BIRD_RUN ? 'good' : 'warn'}
        />
        <Stat
          label="Roost"
          value={`${metrics.roostLinearFt} ft`}
          sub={`need ${metrics.requiredRoostFt} ft`}
          tone={metrics.roostLinearFt >= metrics.requiredRoostFt ? 'good' : 'warn'}
        />
        <Stat
          label="Nest boxes"
          value={metrics.nestingBoxes}
          sub={`need ${metrics.requiredNestingBoxes}`}
          tone={metrics.nestingBoxes >= metrics.requiredNestingBoxes ? 'good' : 'warn'}
        />
        <Stat
          label="Roof pitch"
          value={metrics.roofPitch}
          sub="one continuous roof"
          tone="default"
        />
      </div>

      {/* Budget + warnings */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardBody>
            <SectionTitle title="Budget" subtitle="Materials vs your target" />
            <BudgetMeter budget={budget} showCategories />
            {budget.overBudget && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <div className="mb-1 flex items-center gap-1.5 font-semibold">
                  <Lightbulb size={15} /> Ways to hit {money(budget.budget)}
                </div>
                <ul className="ml-4 list-disc space-y-0.5 text-amber-700">
                  <li>Shorten the run (e.g. 12×16) — biggest single saving.</li>
                  <li>Switch the run roof to corrugated metal.</li>
                  <li>Build the run in a second phase.</li>
                  <li className="font-medium">Never cut hardware cloth or latches to save money.</li>
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardBody>
            <SectionTitle
              title="Design checks"
              subtitle={
                errors.length > 0
                  ? `${errors.length} issue${errors.length > 1 ? 's' : ''} to resolve`
                  : 'Space, structure, predator-proofing & budget'
              }
            />
            <WarningList warnings={errors.length > 0 ? errors : nonErrors.slice(0, 4)} />
            {errors.length > 0 && nonErrors.length > 0 && (
              <p className="mt-2 text-xs text-timber-500">+ {nonErrors.length} more note(s) on the Design screen.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Build progress */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Build progress"
            subtitle={`${doneSteps} of ${totalSteps} steps · 20 phases`}
            right={
              <Link href="/checklist" className="btn-secondary text-sm">
                <Hammer size={15} /> Open checklist
              </Link>
            }
          />
          <ProgressBar value={progress} tone={progress === 100 ? 'moss' : 'blueprint'} />
          <div className="mt-1 text-right text-xs font-semibold text-timber-500">{Math.round(progress)}%</div>
        </CardBody>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink href="/design" icon={<Ruler size={18} />} label="Adjust design" />
        <QuickLink href="/model" icon={<Box size={18} />} label="View 3D model" />
        <QuickLink href="/shopping" icon={<ShoppingCart size={18} />} label="Shopping list" />
        <QuickLink href="/checklist" icon={<Hammer size={18} />} label="Start building" />
      </div>

      {/* Recommended design summary */}
      <Card>
        <CardBody>
          <SectionTitle title="Recommended design" subtitle="Your editable starting point" />
          <div className="grid gap-4 sm:grid-cols-2">
            <RecItem title="Coop" lines={[
              `${project.coop.widthFt}×${project.coop.depthFt} ft walk-in, ${project.coop.frontWallHeightFt} ft tall (ridge) wall`,
              `ONE continuous shed roof (${metrics.roofPitch}) over coop + run, corrugated PVC`,
              `PT skids + deck blocks — movable, no post holes`,
              `Owner-supplied vinyl plank over 3/4" subfloor`,
              `${project.options.nestingBoxCount} outside-access ${project.options.nestingBoxType.replace('-', ' ')} boxes`,
              project.coop.hasAutoChickenDoor ? 'Automatic chicken door (security-critical)' : 'Manual pop door',
            ]} />
            <RecItem title="Run & protection" lines={[
              `${project.run.widthFt}×${project.run.lengthFt} ft attached walk-in run`,
              `Modular bolt-together panels under the same continuous roof`,
              `1/2" hardware cloth everywhere — not chicken wire`,
              project.options.antiDig === 'apron' ? `${project.options.antiDigApronFt} ft anti-dig apron` : `Anti-dig: ${project.options.antiDig}`,
              `Suspended feeders to deter rats`,
              project.options.heatedWater ? 'Heated water via outdoor GFCI cord' : 'No heated water',
            ]} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/design" className="btn-primary text-sm">
              Customize <ArrowRight size={15} />
            </Link>
            <Link href="/export" className="btn-secondary text-sm">
              Export full plan
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-timber-200 bg-white p-4 text-center text-sm font-semibold text-timber-800 shadow-card transition-colors hover:border-blueprint-300 hover:bg-blueprint-50"
    >
      <span className="text-blueprint-600">{icon}</span>
      {label}
    </Link>
  );
}

function RecItem({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-timber-200 bg-timber-50 p-4">
      <h3 className="mb-2 font-bold text-timber-900">{title}</h3>
      <ul className="space-y-1 text-sm text-timber-700">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-timber-400" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
