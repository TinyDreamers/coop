'use client';

import type { BudgetSummary } from '@/lib/types';
import { money } from '@/lib/format';
import { ProgressBar, cn } from '@/components/ui';

/**
 * Budget-vs-target meter. Shows the total, the target, and remaining/over with
 * an appropriately toned progress bar.
 */
export function BudgetMeter({ budget, showCategories }: { budget: BudgetSummary; showCategories?: boolean }) {
  const pct = budget.budget > 0 ? (budget.total / budget.budget) * 100 : 0;
  const tone = budget.overBudget ? 'red' : pct > 85 ? 'amber' : 'moss';

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-timber-900">{money(budget.total)}</div>
          <div className="text-xs text-timber-500">of {money(budget.budget)} target</div>
        </div>
        <div className={cn('text-right text-sm font-semibold', budget.overBudget ? 'text-red-600' : 'text-moss-600')}>
          {budget.overBudget
            ? `${money(Math.abs(budget.remaining))} over`
            : `${money(budget.remaining)} left`}
        </div>
      </div>
      <div className="mt-2">
        <ProgressBar value={pct} tone={tone} />
      </div>
      {budget.optionalTotal > 0 && (
        <div className="mt-2 text-xs text-timber-500">
          + {money(budget.optionalTotal)} in optional add-ons (not counted above)
        </div>
      )}

      {showCategories && (
        <div className="mt-4 space-y-1.5">
          {budget.byCategory
            .slice()
            .sort((a, b) => b.total - a.total)
            .map((c) => {
              const w = budget.materialsSubtotal > 0 ? (c.total / budget.materialsSubtotal) * 100 : 0;
              return (
                <div key={c.category} className="flex items-center gap-2 text-sm">
                  <span className="w-40 flex-shrink-0 truncate text-timber-600">{c.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-timber-100">
                    <div className="h-full rounded-full bg-timber-400" style={{ width: `${w}%` }} />
                  </div>
                  <span className="w-16 flex-shrink-0 text-right font-semibold text-timber-800">
                    {money(c.total)}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
