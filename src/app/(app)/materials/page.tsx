'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { Card, CardBody, SectionTitle, Badge, Button, Segmented, cn } from '@/components/ui';
import { money, PRICE_SOURCE_LABEL, PRICE_SOURCE_STYLE } from '@/lib/format';
import { MATERIAL_CATEGORIES } from '@/lib/types';
import type { ItemStatus, MaterialItem } from '@/lib/types';
import { homeDepotSearchUrl } from '@/lib/pricing/provider';
import {
  ChevronDown,
  ExternalLink,
  Lock,
  Unlock,
  RefreshCw,
  ShieldAlert,
  Search,
} from 'lucide-react';

const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: 'need', label: 'Buy' },
  { value: 'owned', label: 'Owned' },
  { value: 'optional', label: 'Optional' },
  { value: 'excluded', label: 'Skip' },
];

export default function MaterialsPage() {
  const { project, computed } = useProjectStore();
  const [activeCat, setActiveCat] = useState<string>('all');

  const materials = computed?.materials ?? [];
  const catsPresent = useMemo(() => {
    const set = new Set(materials.map((m) => m.category));
    return MATERIAL_CATEGORIES.filter((c) => set.has(c.id));
  }, [materials]);

  if (!project || !computed) return null;

  const shown = activeCat === 'all' ? materials : materials.filter((m) => m.category === activeCat);
  const grandTotal = computed.budget.total;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <SectionTitle
            title="Materials & pricing"
            subtitle={`${materials.length} line items · ${money(grandTotal)} to buy`}
          />
          <p className="text-sm text-timber-600">
            Prices start from a cached Concord-NH snapshot. Edit any price, lock a specific Home Depot
            SKU, or check a live search. Set an item to <b>Owned</b>, <b>Optional</b>, or <b>Skip</b> to
            change what counts toward the budget.
          </p>
        </CardBody>
      </Card>

      {/* Category filter */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <CatChip active={activeCat === 'all'} onClick={() => setActiveCat('all')} label="All" />
        {catsPresent.map((c) => (
          <CatChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={c.label} />
        ))}
      </div>

      <div className="space-y-2">
        {shown.map((m) => (
          <MaterialRow key={m.id} item={m} />
        ))}
      </div>
    </div>
  );
}

function CatChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
        active ? 'border-blueprint-600 bg-blueprint-600 text-white' : 'border-timber-300 bg-white text-timber-700',
      )}
    >
      {label}
    </button>
  );
}

function MaterialRow({ item }: { item: MaterialItem }) {
  const { setPriceOverride, setMaterialOverride, lockProduct, unlockProduct } = useProjectStore();
  const [open, setOpen] = useState(false);
  const [priceInput, setPriceInput] = useState(String(item.unitPrice));
  // Re-sync the manual price field when the resolved price changes externally
  // (e.g. after locking a SKU or a design change), so a later "Set" won't write
  // back a stale value.
  useEffect(() => {
    setPriceInput(String(item.unitPrice));
  }, [item.unitPrice]);
  const [live, setLive] = useState<{ loading: boolean; message?: string; url?: string } | null>(null);
  const [skuForm, setSkuForm] = useState<{ sku: string; name: string; price: string } | null>(null);

  const dimmed = item.status === 'excluded' || item.status === 'owned';

  function commitPrice() {
    const v = parseFloat(priceInput);
    if (Number.isFinite(v) && v >= 0) {
      setPriceOverride(item.id, { unitPrice: v, source: 'manual', updatedAt: new Date().toISOString() });
    }
  }

  async function checkLive() {
    setLive({ loading: true });
    try {
      const res = await fetch(`/api/pricing?term=${encodeURIComponent(item.searchTerm)}`);
      const data = await res.json();
      setLive({ loading: false, message: data.message, url: data.searchUrl });
    } catch {
      setLive({ loading: false, message: 'Live lookup failed — enter the price manually.', url: homeDepotSearchUrl(item.searchTerm) });
    }
  }

  return (
    <Card className={cn(dimmed && 'opacity-70')}>
      <div className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <button onClick={() => setOpen((o) => !o)} className="mt-0.5 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-timber-900">{item.name}</span>
              {item.securityCritical && (
                <Badge className="bg-red-50 text-red-600">
                  <ShieldAlert size={12} /> security
                </Badge>
              )}
              {item.ownerSupplied && <Badge className="bg-moss-100 text-moss-700">owned</Badge>}
              {item.homeDepotSku && (
                <Badge className="bg-blueprint-50 text-blueprint-700">
                  <Lock size={11} /> SKU {item.homeDepotSku}
                </Badge>
              )}
            </div>
            <div className="mt-0.5 text-xs text-timber-500">{item.spec}</div>
          </button>
          <div className="flex-shrink-0 text-right">
            <div className="font-bold text-timber-900">{money(item.lineTotal)}</div>
            <div className="text-xs text-timber-500">
              {item.qty} {item.unit} × {money(item.unitPrice)}
            </div>
            <span className={cn('badge mt-1', PRICE_SOURCE_STYLE[item.priceSource])}>
              {PRICE_SOURCE_LABEL[item.priceSource]}
            </span>
          </div>
          <ChevronDown size={18} className={cn('mt-1 flex-shrink-0 text-timber-400 transition-transform', open && 'rotate-180')} />
        </div>

        {open && (
          <div className="mt-3 space-y-3 border-t border-timber-100 pt-3">
            {/* Status */}
            <div>
              <div className="label">Status</div>
              <Segmented
                value={item.status}
                onChange={(v) => setMaterialOverride(item.id, { status: v })}
                options={STATUS_OPTIONS}
              />
            </div>

            {/* Price editing */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="label">Unit price (manual)</div>
                <div className="flex gap-2">
                  <input
                    className="input"
                    inputMode="decimal"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    onBlur={commitPrice}
                  />
                  <Button variant="secondary" onClick={commitPrice}>Set</Button>
                  {item.priceSource === 'manual' && (
                    <Button variant="ghost" onClick={() => { setPriceOverride(item.id, null); setPriceInput(''); }} title="Reset to cached">
                      <RefreshCw size={15} />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <div className="label">Home Depot search</div>
                <div className="flex gap-2">
                  <input
                    className="input"
                    value={item.searchTerm}
                    onChange={(e) => setMaterialOverride(item.id, { searchTerm: e.target.value })}
                  />
                  <a className="btn-secondary" href={homeDepotSearchUrl(item.searchTerm)} target="_blank" rel="noreferrer" title="Open on homedepot.com">
                    <ExternalLink size={15} />
                  </a>
                </div>
              </div>
            </div>

            {/* Live price check */}
            <div>
              <Button variant="ghost" onClick={checkLive} disabled={live?.loading}>
                <Search size={15} /> {live?.loading ? 'Checking…' : 'Check live price'}
              </Button>
              {live?.message && (
                <p className="mt-1 text-xs text-amber-700">
                  {live.message}{' '}
                  {live.url && (
                    <a className="font-semibold text-blueprint-600 underline" href={live.url} target="_blank" rel="noreferrer">
                      open search
                    </a>
                  )}
                </p>
              )}
            </div>

            {/* SKU lock */}
            <div>
              {item.homeDepotSku ? (
                <Button variant="ghost" onClick={() => unlockProduct(item.id)}>
                  <Unlock size={15} /> Unlock SKU {item.homeDepotSku}
                </Button>
              ) : skuForm ? (
                <div className="grid gap-2 sm:grid-cols-4">
                  <input className="input" placeholder="SKU / model #" value={skuForm.sku} onChange={(e) => setSkuForm({ ...skuForm, sku: e.target.value })} />
                  <input className="input sm:col-span-2" placeholder="Product name" value={skuForm.name} onChange={(e) => setSkuForm({ ...skuForm, name: e.target.value })} />
                  <input className="input" placeholder="Price" inputMode="decimal" value={skuForm.price} onChange={(e) => setSkuForm({ ...skuForm, price: e.target.value })} />
                  <div className="sm:col-span-4 flex gap-2">
                    <Button
                      variant="primary"
                      onClick={() => {
                        lockProduct(item.id, {
                          sku: skuForm.sku || 'n/a',
                          name: skuForm.name || item.name,
                          unitPrice: parseFloat(skuForm.price) || item.unitPrice,
                          priceSource: 'cached',
                          lockedAt: new Date().toISOString(),
                        });
                        setSkuForm(null);
                      }}
                    >
                      Lock it
                    </Button>
                    <Button variant="ghost" onClick={() => setSkuForm(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" onClick={() => setSkuForm({ sku: '', name: item.name, price: String(item.unitPrice) })}>
                  <Lock size={15} /> Lock a specific product / SKU
                </Button>
              )}
            </div>

            {item.notes && <p className="text-xs text-timber-500">{item.notes}</p>}
            <p className="text-xs text-timber-400">Phase {item.phase} · base qty {item.baseQty}{item.wasteFactor > 0 ? ` +${Math.round(item.wasteFactor * 100)}% waste` : ''}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
