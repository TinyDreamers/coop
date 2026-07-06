'use client';

import { useMemo, useState } from 'react';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { Card, CardBody, SectionTitle, Stat, Badge, Button, Toggle, EmptyState, cn } from '@/components/ui';
import { money, num, pluralize, PRICE_SOURCE_LABEL, PRICE_SOURCE_STYLE } from '@/lib/format';
import { MATERIAL_CATEGORIES } from '@/lib/types';
import type { MaterialItem } from '@/lib/types';
import { homeDepotSearchUrl } from '@/lib/pricing/provider';
import { exportShoppingCsv } from '@/lib/csv';
import { ShoppingCart, ExternalLink, Lock, Download, Check, ListChecks } from 'lucide-react';

/**
 * SHOPPING MODE
 * -------------
 * A stripped-down, checklist-style view for the actual Home Depot run. It shows
 * only the lines the user still needs to buy ("need" status), grouped by
 * category in MATERIAL_CATEGORIES order, with a running subtotal per group.
 *
 * Everything here is READ-ONLY with respect to the project document — the only
 * interactivity is a LOCAL check-off state (a Set of ids) so a shopper can tick
 * items into the cart as they grab them. That state is intentionally NOT
 * persisted: it resets on reload and never touches the store, keeping this a
 * pure, disposable shopping session.
 */
export default function ShoppingPage() {
  const { project, computed } = useProjectStore();

  // Local-only check-off state (not persisted). Holds material ids of grabbed
  // items so we can strike them through and dim the row.
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // Reveal the optional add-ons section (kept collapsed by default so the core
  // buy list stays focused).
  const [showOptional, setShowOptional] = useState(false);

  // AppShell handles the loading state; bail until the project is computed.
  const materials = computed?.materials ?? [];

  // Split out the two lists we care about here.
  const needItems = useMemo(() => materials.filter((m) => m.status === 'need'), [materials]);
  const optionalItems = useMemo(() => materials.filter((m) => m.status === 'optional'), [materials]);

  // Group the "need" items by category, preserving MATERIAL_CATEGORIES order and
  // dropping any empty categories. Each group carries a subtotal (sum of line
  // totals) so the header can show a running spend per section.
  const groups = useMemo(() => {
    return MATERIAL_CATEGORIES.map((cat) => {
      const items = needItems.filter((m) => m.category === cat.id);
      const subtotal = items.reduce((sum, m) => sum + m.lineTotal, 0);
      return { ...cat, items, subtotal };
    }).filter((g) => g.items.length > 0);
  }, [needItems]);

  if (!project || !computed) return null;

  const grandTotal = computed.budget.total;
  const checkedCount = needItems.filter((m) => checked.has(m.id)).length;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Nothing to buy at all — celebrate the empty cart.
  if (needItems.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<ShoppingCart size={40} />}
          title="Nothing left to buy"
          children={
            <>
              No line items are marked <b>Buy</b> right now. Set an item back to <b>Buy</b> on the
              Materials screen, or check the optional add-ons below.
            </>
          }
        />
        {optionalItems.length > 0 && (
          <OptionalSection
            items={optionalItems}
            show={showOptional}
            onToggle={setShowOptional}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---- Summary card ---- */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Shopping mode"
            subtitle="Your Home Depot run — tick items off as you grab them."
            right={
              <Button variant="secondary" onClick={() => exportShoppingCsv(computed)}>
                <Download size={15} /> Export CSV
              </Button>
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Grand total" value={money(grandTotal)} sub="materials + tax" />
            <Stat
              label="Items to buy"
              value={num(needItems.length)}
              sub={`${pluralize(groups.length, 'category', 'categories')}`}
            />
            <Stat
              label="In cart"
              value={`${num(checkedCount)} / ${num(needItems.length)}`}
              sub={checkedCount === needItems.length ? 'all grabbed 🎉' : 'checked off'}
              tone={checkedCount === needItems.length ? 'good' : 'default'}
            />
          </div>
        </CardBody>
      </Card>

      {/* ---- Category groups ---- */}
      <div className="space-y-4">
        {groups.map((group) => (
          <Card key={group.id}>
            <div className="p-3 sm:p-4">
              {/* Group header: label + running subtotal */}
              <div className="mb-2 flex items-center justify-between gap-3 border-b border-timber-100 pb-2">
                <h3 className="font-bold text-timber-900">{group.label}</h3>
                <div className="text-right">
                  <div className="font-bold text-timber-900">{money(group.subtotal)}</div>
                  <div className="text-xs text-timber-500">
                    {group.items.length} {pluralize(group.items.length, 'item')}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-timber-50">
                {group.items.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    checked={checked.has(item.id)}
                    onToggle={() => toggle(item.id)}
                  />
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ---- Optional add-ons (collapsible) ---- */}
      {optionalItems.length > 0 && (
        <OptionalSection items={optionalItems} show={showOptional} onToggle={setShowOptional} />
      )}
    </div>
  );
}

/**
 * A single buy-list row. Left: a big tap target that toggles the check-off
 * state (strikes through + dims the row when grabbed). Right: pricing, source
 * badge, SKU badge, and a "Search Home Depot" link.
 */
function ShoppingRow({
  item,
  checked,
  onToggle,
}: {
  item: MaterialItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cn('flex items-start gap-3 py-3 transition-opacity', checked && 'opacity-45')}>
      {/* Check-off box — local state only, not persisted */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={checked ? `Uncheck ${item.name}` : `Check off ${item.name}`}
        className={cn(
          'mt-0.5 flex h-11 w-11 flex-shrink-0 touch-manipulation items-center justify-center rounded-md border-2 transition-colors',
          checked
            ? 'border-moss-600 bg-moss-600 text-white'
            : 'border-timber-300 bg-white text-transparent hover:border-blueprint-500',
        )}
      >
        <Check size={16} strokeWidth={3} />
      </button>

      {/* Name + spec + links */}
      <div className="min-w-0 flex-1">
        <div className={cn('flex flex-wrap items-center gap-2', checked && 'line-through')}>
          <span className="font-semibold text-timber-900">{item.name}</span>
          {item.homeDepotSku && (
            <Badge className="bg-blueprint-50 text-blueprint-700">
              <Lock size={11} /> SKU {item.homeDepotSku}
            </Badge>
          )}
        </div>
        {item.spec && <div className="mt-0.5 text-xs text-timber-500">{item.spec}</div>}
        <a
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blueprint-600 hover:underline"
          href={homeDepotSearchUrl(item.searchTerm)}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={12} /> Search Home Depot
        </a>
      </div>

      {/* Qty + pricing + source */}
      <div className="flex-shrink-0 text-right">
        <div className="font-bold text-timber-900">{money(item.lineTotal)}</div>
        <div className="whitespace-nowrap text-xs text-timber-500">
          {num(item.qty)} {item.unit} × {money(item.unitPrice)}
        </div>
        <span className={cn('badge mt-1', PRICE_SOURCE_STYLE[item.priceSource])}>
          {PRICE_SOURCE_LABEL[item.priceSource]}
        </span>
      </div>
    </div>
  );
}

/**
 * Optional add-ons section. Hidden behind a toggle so it doesn't clutter the
 * core buy list. These items are NOT part of the grand total (they carry the
 * "optional" status), so we show their prices for reference and total them
 * separately.
 */
function OptionalSection({
  items,
  show,
  onToggle,
}: {
  items: MaterialItem[];
  show: boolean;
  onToggle: (v: boolean) => void;
}) {
  const optionalTotal = items.reduce((sum, m) => sum + m.qty * m.unitPrice, 0);

  return (
    <Card>
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks size={18} className="text-timber-400" />
            <div>
              <div className="font-bold text-timber-900">Optional add-ons</div>
              <div className="text-xs text-timber-500">
                {items.length} {pluralize(items.length, 'item')} · {money(optionalTotal)} · not in the total
              </div>
            </div>
          </div>
          <Toggle checked={show} onChange={onToggle} label="Show" />
        </div>

        {show && (
          <div className="mt-3 divide-y divide-timber-50 border-t border-timber-100 pt-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-timber-900">{item.name}</span>
                    {item.homeDepotSku && (
                      <Badge className="bg-blueprint-50 text-blueprint-700">
                        <Lock size={11} /> SKU {item.homeDepotSku}
                      </Badge>
                    )}
                  </div>
                  {item.spec && <div className="mt-0.5 text-xs text-timber-500">{item.spec}</div>}
                  <a
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blueprint-600 hover:underline"
                    href={homeDepotSearchUrl(item.searchTerm)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={12} /> Search Home Depot
                  </a>
                </div>
                <div className="flex-shrink-0 text-right">
                  {/* Use qty × unitPrice because optional lines have lineTotal 0 in the engine. */}
                  <div className="font-bold text-timber-900">{money(item.qty * item.unitPrice)}</div>
                  <div className="text-xs text-timber-500">
                    {num(item.qty)} {item.unit} × {money(item.unitPrice)}
                  </div>
                  <span className={cn('badge mt-1', PRICE_SOURCE_STYLE[item.priceSource])}>
                    {PRICE_SOURCE_LABEL[item.priceSource]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
