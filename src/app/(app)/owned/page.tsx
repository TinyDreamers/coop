'use client';

import { useMemo, useRef, useState } from 'react';
import { useProjectStore } from '@/lib/store/useProjectStore';
import {
  Card,
  CardBody,
  SectionTitle,
  Badge,
  Button,
  Field,
  NumberField,
  Select,
  EmptyState,
  cn,
} from '@/components/ui';
import { money, num, pluralize } from '@/lib/format';
import { exportOwnedCsv, importOwnedCsv } from '@/lib/csv';
import type { OwnedMaterial } from '@/lib/types';
import { PackageCheck, Plus, Trash2, Download, Upload, Link2 } from 'lucide-react';

/**
 * OWNED MATERIALS inventory.
 *
 * Anything the owner already has can be recorded here. When an owned item is
 * *matched* to a generated material line (via `matchesMaterialId`), the engine
 * flips that line to "owned" so it drops off the shopping list and out of the
 * budget subtotal. Unmatched items are just kept for reference (their estimated
 * value is informational only).
 *
 * Mirrors the Materials screen: one editable Card per item, a store-backed
 * add form, and CSV import/export for spreadsheet round-tripping.
 */
export default function OwnedPage() {
  const { project, computed } = useProjectStore();
  const fileRef = useRef<HTMLInputElement>(null);

  // Options for the "Matches material" selects — an empty sentinel plus every
  // generated material line. Recomputed only when the material set changes.
  const materialOptions = useMemo(() => {
    const mats = computed?.materials ?? [];
    return [
      { value: '', label: '— not matched —' },
      ...mats.map((m) => ({ value: m.id, label: m.name })),
    ];
  }, [computed?.materials]);

  if (!project || !computed) return null;

  const owned = project.ownedMaterials;
  const matchedCount = owned.filter((o) => o.matchesMaterialId).length;

  return (
    <div className="space-y-4">
      {/* Intro / explainer + toolbar */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Owned materials"
            subtitle={`${owned.length} ${pluralize(owned.length, 'item')} · ${matchedCount} matched to the build`}
            right={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => exportOwnedCsv(project)}>
                  <Download size={15} /> Export CSV
                </Button>
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  <Upload size={15} /> Import CSV
                </Button>
                {/* Hidden file input — reads the CSV then replaces the project doc. */}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = ''; // allow re-selecting the same file later
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const next = importOwnedCsv(project, text);
                      useProjectStore.getState().replaceProject(next);
                    } catch {
                      // Malformed file — nothing to import; keep the current list.
                    }
                  }}
                />
              </div>
            }
          />
          <p className="text-sm text-timber-600">
            List anything you already have on hand. When you <b>match</b> an item to a material line, that
            line is subtracted from the shopping list and no longer counts toward the budget. Unmatched
            items are kept for reference only.
          </p>
          {computed.budget.ownedValue > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-moss-50 px-3 py-1.5 text-sm font-semibold text-moss-700">
              <PackageCheck size={15} />
              {money(computed.budget.ownedValue)} deducted from the budget
            </div>
          )}
        </CardBody>
      </Card>

      {/* Inventory list */}
      {owned.length === 0 ? (
        <EmptyState
          icon={<PackageCheck size={32} />}
          title="No owned materials yet"
        >
          Add anything you already have — leftover lumber, flooring, hardware — and match it to a build
          line to trim the shopping list and budget.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {owned.map((item) => (
            <OwnedRow key={item.id} item={item} materialOptions={materialOptions} />
          ))}
        </div>
      )}

      {/* Add-item form */}
      <AddOwnedForm materialOptions={materialOptions} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable inventory row
// ---------------------------------------------------------------------------
function OwnedRow({
  item,
  materialOptions,
}: {
  item: OwnedMaterial;
  materialOptions: { value: string; label: string }[];
}) {
  const { updateOwned, removeOwned } = useProjectStore();

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Field label="Name">
              <input
                className="input"
                value={item.name}
                onChange={(e) => updateOwned(item.id, { name: e.target.value })}
                placeholder="e.g. Leftover 2x4 studs"
              />
            </Field>
          </div>
          {item.matchesMaterialId && (
            <Badge className="mt-6 flex-shrink-0 bg-moss-100 text-moss-700">
              <Link2 size={11} /> matched
            </Badge>
          )}
        </div>

        {/* Quantity + unit */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quantity">
            <NumberField
              value={item.quantity}
              onChange={(v) => updateOwned(item.id, { quantity: v })}
              min={0}
              step={1}
            />
          </Field>
          <Field label="Unit">
            <input
              className="input"
              value={item.unit}
              onChange={(e) => updateOwned(item.id, { unit: e.target.value })}
              placeholder="each · sqft · box…"
            />
          </Field>
        </div>

        {/* Match to a generated material line */}
        <Field label="Matches material" hint="Subtracts this line from the shopping list + budget.">
          <Select
            value={item.matchesMaterialId ?? ''}
            onChange={(v) => updateOwned(item.id, { matchesMaterialId: v || undefined })}
            options={materialOptions}
          />
        </Field>

        {/* Estimated value + note */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Estimated value" hint="Budget context only.">
            <NumberField
              value={item.estimatedValue ?? 0}
              onChange={(v) => updateOwned(item.id, { estimatedValue: v })}
              min={0}
              step={1}
              suffix="USD"
            />
          </Field>
          <Field label="Note">
            <input
              className="input"
              value={item.note ?? ''}
              onChange={(e) => updateOwned(item.id, { note: e.target.value })}
              placeholder="Where it is, condition, etc."
            />
          </Field>
        </div>

        <div className="flex items-center justify-between border-t border-timber-100 pt-3">
          <span className="text-xs text-timber-400">
            {num(item.quantity)} {item.unit}
            {item.estimatedValue ? ` · ~${money(item.estimatedValue)}` : ''}
          </span>
          <Button variant="danger" onClick={() => removeOwned(item.id)}>
            <Trash2 size={15} /> Delete
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add-item form
// ---------------------------------------------------------------------------
const EMPTY_FORM = {
  name: '',
  quantity: 1,
  unit: 'each',
  matchesMaterialId: '',
  estimatedValue: 0,
  note: '',
};

function AddOwnedForm({
  materialOptions,
}: {
  materialOptions: { value: string; label: string }[];
}) {
  const { addOwned } = useProjectStore();
  const [form, setForm] = useState(EMPTY_FORM);

  const canAdd = form.name.trim().length > 0;

  function submit() {
    if (!canAdd) return;
    addOwned({
      id: `owned-${Date.now()}`,
      name: form.name.trim(),
      quantity: form.quantity,
      unit: form.unit.trim() || 'each',
      matchesMaterialId: form.matchesMaterialId || undefined,
      estimatedValue: form.estimatedValue || undefined,
      note: form.note.trim() || undefined,
    });
    setForm(EMPTY_FORM); // reset for the next entry
  }

  return (
    <Card className="border-dashed">
      <CardBody className="space-y-3">
        <SectionTitle title="Add an item" subtitle="Record something you already own." />

        <Field label="Name">
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Box of 3 in. exterior screws"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quantity">
            <NumberField
              value={form.quantity}
              onChange={(v) => setForm({ ...form, quantity: v })}
              min={0}
              step={1}
            />
          </Field>
          <Field label="Unit">
            <input
              className="input"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="each · sqft · box…"
            />
          </Field>
        </div>

        <Field label="Matches material" hint="Optional — subtracts this line from the shopping list.">
          <Select
            value={form.matchesMaterialId}
            onChange={(v) => setForm({ ...form, matchesMaterialId: v })}
            options={materialOptions}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Estimated value">
            <NumberField
              value={form.estimatedValue}
              onChange={(v) => setForm({ ...form, estimatedValue: v })}
              min={0}
              step={1}
              suffix="USD"
            />
          </Field>
          <Field label="Note">
            <input
              className="input"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Optional"
            />
          </Field>
        </div>

        <Button
          variant="primary"
          onClick={submit}
          disabled={!canAdd}
          className={cn('w-full sm:w-auto', !canAdd && 'opacity-50')}
        >
          <Plus size={16} /> Add item
        </Button>
      </CardBody>
    </Card>
  );
}
