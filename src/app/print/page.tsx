'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { Spinner } from '@/components/ui';
import { money, inchesToFtIn } from '@/lib/format';
import { MATERIAL_CATEGORIES } from '@/lib/types';
import { TOOL_CHECKLIST } from '@/lib/constants';
import { Printer, ArrowLeft } from 'lucide-react';

/**
 * Standalone printable plan. Lives OUTSIDE the app shell so it prints clean.
 * Loads the project itself (no AppShell here), then renders the whole plan.
 * Use the browser's "Save as PDF" for a full document, or the jsPDF export on
 * the Export screen.
 */
export default function PrintPage() {
  const { project, computed, load, status } = useProjectStore();

  useEffect(() => {
    void load();
  }, [load]);

  if (status !== 'ready' || !project || !computed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const { metrics, budget, warnings, materials, cutList, phases } = computed;
  const shopping = materials.filter((m) => m.status === 'need');
  const owned = materials.filter((m) => m.status === 'owned' || m.ownerSupplied);

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-slate-800 print:p-0">
      {/* Toolbar (hidden on print) */}
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href="/export" className="btn-ghost">
          <ArrowLeft size={16} /> Back
        </Link>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      {/* Title */}
      <header className="border-b-2 border-timber-800 pb-3">
        <h1 className="text-3xl font-bold text-timber-900">Chicken Coop Build Plan</h1>
        <p className="text-timber-600">
          {project.name} · {project.settings.storeArea} · {new Date().toLocaleDateString()}
        </p>
      </header>

      {/* Summary */}
      <Section title="Project summary">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <KV k="Flock" v={`${project.options.chickens} large birds`} />
          <KV k="Coop" v={`${project.coop.widthFt}×${project.coop.depthFt} ft (${metrics.coopAreaSqft} sf)`} />
          <KV k="Run" v={`${project.run.widthFt}×${project.run.lengthFt} ft (${metrics.runAreaSqft} sf)`} />
          <KV k="Coop / bird" v={`${metrics.coopAreaPerBird} sf`} />
          <KV k="Run / bird" v={`${metrics.runAreaPerBird} sf`} />
          <KV k="Roost" v={`${metrics.roostLinearFt} ft`} />
          <KV k="Nest boxes" v={`${metrics.nestingBoxes}`} />
          <KV k="Coop roof pitch" v={metrics.coopRoofPitch} />
          <KV k="Estimated total" v={money(budget.total)} />
        </div>
      </Section>

      {/* Warnings */}
      <Section title="Design checks & warnings">
        {warnings.length === 0 ? (
          <p className="text-sm text-moss-700">No blocking issues — space, structure & predator-proofing pass.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {warnings.map((w) => (
              <li key={w.id}>
                <span className="font-semibold uppercase text-timber-500">[{w.severity}]</span>{' '}
                <span className="font-semibold">{w.title}.</span> {w.detail}
                {w.fix && <span className="italic text-timber-600"> → {w.fix}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Budget */}
      <Section title="Budget">
        <table className="w-full text-sm">
          <tbody>
            {budget.byCategory.map((c) => (
              <tr key={c.category} className="border-b border-slate-100">
                <td className="py-1">{c.label}</td>
                <td className="py-1 text-right font-medium">{money(c.total)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-timber-800 font-bold">
              <td className="py-1">Total (target {money(budget.budget)})</td>
              <td className={`py-1 text-right ${budget.overBudget ? 'text-red-600' : 'text-moss-700'}`}>
                {money(budget.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Shopping list */}
      <Section title="Shopping list" breakBefore>
        {MATERIAL_CATEGORIES.map((cat) => {
          const items = shopping.filter((m) => m.category === cat.id);
          if (!items.length) return null;
          return (
            <div key={cat.id} className="mb-3">
              <h3 className="font-bold text-timber-800">{cat.label}</h3>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100">
                      <td className="py-0.5">{m.name}</td>
                      <td className="w-20 py-0.5 text-right text-slate-500">{m.qty} {m.unit}</td>
                      <td className="w-20 py-0.5 text-right font-medium">{money(m.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </Section>

      {/* Owner-supplied */}
      {owned.length > 0 && (
        <Section title="Owner-supplied materials">
          <ul className="list-disc pl-5 text-sm">
            {owned.map((m) => (
              <li key={m.id}>{m.name} — {m.qty} {m.unit}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Cut list */}
      <Section title="Cut list" breakBefore>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-timber-800 text-left">
              <th className="py-1">Ph</th>
              <th>Part</th>
              <th>Stock</th>
              <th>Length</th>
              <th className="text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            {cutList.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-0.5">{c.phase}</td>
                <td>{c.part}</td>
                <td>{c.stock}</td>
                <td>{inchesToFtIn(c.lengthIn)}</td>
                <td className="text-right">{c.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Tools */}
      <Section title="Tools">
        <ul className="grid grid-cols-2 gap-x-6 text-sm">
          {TOOL_CHECKLIST.map((t) => (
            <li key={t.tool}>
              {t.owned ? '☑' : '☐'} {t.tool}
              {t.note && <span className="text-slate-500"> — {t.note}</span>}
            </li>
          ))}
        </ul>
      </Section>

      {/* Build phases */}
      <Section title="Build phases & checklist" breakBefore>
        <div className="space-y-3">
          {phases.map((ph) => (
            <div key={ph.id} className="break-inside-avoid">
              <h3 className="font-bold text-timber-900">
                {ph.id}. {ph.title} <span className="font-normal text-slate-500">(~{ph.estimatedHours} hr)</span>
              </h3>
              <p className="text-sm text-slate-600">{ph.summary}</p>
              {ph.tools.length > 0 && <p className="text-xs text-slate-500"><b>Tools:</b> {ph.tools.join(', ')}</p>}
              <ol className="mt-1 space-y-0.5 text-sm">
                {ph.steps.map((s, i) => (
                  <li key={i}>☐ {s.text}{s.safety && <span className="italic text-amber-700"> (Safety: {s.safety})</span>}</li>
                ))}
              </ol>
              {ph.commonMistakes.length > 0 && (
                <p className="mt-1 text-xs text-slate-500"><b>Avoid:</b> {ph.commonMistakes.join('; ')}</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <footer className="mt-8 border-t border-slate-200 pt-3 text-center text-xs text-slate-400">
        Generated by Coop Planner · {new Date().toLocaleString()}
      </footer>
    </div>
  );
}

function Section({ title, children, breakBefore }: { title: string; children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <section className={breakBefore ? 'print-break mt-6' : 'mt-6'}>
      <h2 className="mb-2 text-lg font-bold text-timber-900">{title}</h2>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-0.5">
      <span className="text-slate-500">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
