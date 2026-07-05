'use client';

import type { Warning, WarningSeverity } from '@/lib/types';
import { AlertTriangle, AlertOctagon, Info, ShieldCheck } from 'lucide-react';
import { cn } from '@/components/ui';

/**
 * Renders the design warnings with severity styling. Shared by the dashboard,
 * design screen, and print/export.
 */
const CONFIG: Record<
  WarningSeverity,
  { icon: typeof Info; box: string; iconColor: string }
> = {
  error: { icon: AlertOctagon, box: 'border-red-200 bg-red-50', iconColor: 'text-red-600' },
  warning: { icon: AlertTriangle, box: 'border-amber-200 bg-amber-50', iconColor: 'text-amber-600' },
  info: { icon: Info, box: 'border-blueprint-200 bg-blueprint-50', iconColor: 'text-blueprint-600' },
};

export function WarningList({ warnings, compact }: { warnings: Warning[]; compact?: boolean }) {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-moss-200 bg-moss-50 p-4">
        <ShieldCheck className="h-6 w-6 flex-shrink-0 text-moss-600" />
        <div>
          <div className="font-semibold text-moss-700">No blocking issues</div>
          <div className="text-sm text-moss-600">
            Your design meets the space, structural, and predator-proofing checks.
          </div>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {warnings.map((w) => {
        const c = CONFIG[w.severity];
        const Icon = c.icon;
        return (
          <li key={w.id} className={cn('rounded-xl border p-3', c.box)}>
            <div className="flex gap-3">
              <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', c.iconColor)} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-timber-900">{w.title}</span>
                  <span className="badge bg-white/70 uppercase text-timber-500">{w.category}</span>
                </div>
                {!compact && <p className="mt-0.5 text-sm text-timber-700">{w.detail}</p>}
                {!compact && w.fix && (
                  <p className="mt-1 text-sm font-medium text-timber-900">
                    → {w.fix}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
