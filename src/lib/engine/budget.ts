import type { BudgetSummary, CoopProject, MaterialCategory, MaterialItem } from '../types';
import { MATERIAL_CATEGORIES } from '../types';

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Roll the resolved material lines into a budget summary. Only lines with
 * status "need" count toward the subtotal. Owned inventory value and optional
 * add-ons are reported separately so the user sees the true out-of-pocket cost.
 */
export function computeBudget(project: CoopProject, materials: MaterialItem[]): BudgetSummary {
  let materialsSubtotal = 0;
  let optionalTotal = 0;
  const catTotals: Record<string, number> = {};

  for (const m of materials) {
    if (m.status === 'need') {
      materialsSubtotal += m.lineTotal;
      catTotals[m.category] = (catTotals[m.category] ?? 0) + m.lineTotal;
    } else if (m.status === 'optional') {
      // Optional add-ons: price them so the user can see the upgrade cost.
      optionalTotal += round(m.qty * m.unitPrice);
    }
  }

  // Value of owned inventory (informational — shows what you're saving).
  const ownedValue = project.ownedMaterials.reduce(
    (sum, o) => sum + (o.estimatedValue ?? 0),
    0,
  );

  const tax = round(materialsSubtotal * project.settings.salesTaxRate);
  const total = round(materialsSubtotal + tax);
  const budget = project.settings.budget;
  const remaining = round(budget - total);

  const byCategory = MATERIAL_CATEGORIES.map((c) => ({
    category: c.id as MaterialCategory,
    label: c.label,
    total: round(catTotals[c.id] ?? 0),
  })).filter((c) => c.total > 0);

  return {
    materialsSubtotal: round(materialsSubtotal),
    ownedValue: round(ownedValue),
    optionalTotal: round(optionalTotal),
    tax,
    total,
    budget,
    remaining,
    overBudget: total > budget,
    byCategory,
  };
}
