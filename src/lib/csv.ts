import Papa from 'papaparse';
import type { ComputedProject, CoopProject, ItemStatus, MaterialItem } from './types';
import { MATERIAL_CATEGORIES } from './types';
import { inchesToFtIn } from './format';

/**
 * CSV import/export. CSV is for backups + spreadsheets, NOT the live database.
 * Exports are generated from the computed project; imports patch price/status
 * overrides and owned inventory back onto the persisted project document.
 */

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const catLabel = (id: string) => MATERIAL_CATEGORIES.find((c) => c.id === id)?.label ?? id;

// ---- Exports --------------------------------------------------------------

export function exportMaterialsCsv(computed: ComputedProject) {
  const rows = computed.materials.map((m) => ({
    id: m.id,
    category: catLabel(m.category),
    name: m.name,
    spec: m.spec,
    unit: m.unit,
    quantity: m.qty,
    unit_price: m.unitPrice,
    line_total: m.lineTotal,
    price_source: m.priceSource,
    status: m.status,
    home_depot_sku: m.homeDepotSku ?? '',
    search_term: m.searchTerm,
    phase: m.phase,
  }));
  download('coop-materials.csv', Papa.unparse(rows));
}

export function exportShoppingCsv(computed: ComputedProject) {
  const rows = computed.materials
    .filter((m) => m.status === 'need')
    .sort((a, b) => a.category.localeCompare(b.category))
    .map((m) => ({
      category: catLabel(m.category),
      item: m.name,
      quantity: m.qty,
      unit: m.unit,
      unit_price: m.unitPrice,
      line_total: m.lineTotal,
      price_source: m.priceSource,
      home_depot_sku: m.homeDepotSku ?? '',
      search_term: m.searchTerm,
    }));
  download('coop-shopping-list.csv', Papa.unparse(rows));
}

export function exportCutListCsv(computed: ComputedProject) {
  const rows = computed.cutList.map((c) => ({
    phase: c.phase,
    part: c.part,
    stock: c.stock,
    length: inchesToFtIn(c.lengthIn),
    length_inches: c.lengthIn,
    quantity: c.quantity,
    angle_note: c.angleNote ?? '',
  }));
  download('coop-cut-list.csv', Papa.unparse(rows));
}

export function exportOwnedCsv(project: CoopProject) {
  const rows = project.ownedMaterials.map((o) => ({
    id: o.id,
    name: o.name,
    quantity: o.quantity,
    unit: o.unit,
    matches_material_id: o.matchesMaterialId ?? '',
    estimated_value: o.estimatedValue ?? '',
    note: o.note ?? '',
  }));
  download('coop-owned-materials.csv', Papa.unparse(rows));
}

// ---- JSON backup / restore ------------------------------------------------

export function downloadBackup(project: CoopProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = project.updatedAt?.slice(0, 10) ?? 'backup';
  a.download = `coop-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readBackupFile(file: File): Promise<CoopProject> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<CoopProject>;
  if (!parsed || typeof parsed !== 'object' || !('coop' in parsed) || !('run' in parsed)) {
    throw new Error('This does not look like a coop backup file.');
  }
  // Backfill any fields an older/partial backup may be missing so the app never
  // crashes reading e.g. project.exportHistory.length after a restore.
  return {
    ...(parsed as CoopProject),
    ownedMaterials: parsed.ownedMaterials ?? [],
    materialOverrides: parsed.materialOverrides ?? {},
    priceOverrides: parsed.priceOverrides ?? {},
    lockedProducts: parsed.lockedProducts ?? {},
    checklist: parsed.checklist ?? {},
    photos: parsed.photos ?? [],
    exportHistory: parsed.exportHistory ?? [],
    notes: parsed.notes ?? '',
  };
}

// ---- Imports (price/status overrides + owned inventory) -------------------

const VALID_STATUS: ItemStatus[] = ['need', 'owned', 'optional', 'excluded'];

export interface MaterialCsvImportResult {
  priceUpdates: number;
  statusUpdates: number;
  skuUpdates: number;
}

/**
 * Import a materials CSV (previously exported, then hand-edited in a
 * spreadsheet). Applies unit_price, status, and home_depot_sku back onto the
 * project as overrides / locked products. Unknown ids are ignored.
 */
export function importMaterialsCsv(
  project: CoopProject,
  csvText: string,
  currentMaterials: MaterialItem[],
): { project: CoopProject; result: MaterialCsvImportResult } {
  const known = new Set(currentMaterials.map((m) => m.id));
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const next: CoopProject = JSON.parse(JSON.stringify(project));
  const result: MaterialCsvImportResult = { priceUpdates: 0, statusUpdates: 0, skuUpdates: 0 };
  const now = new Date().toISOString();

  for (const row of parsed.data) {
    const id = (row.id ?? '').trim();
    if (!id || !known.has(id)) continue;

    const price = parseFloat(row.unit_price ?? '');
    if (Number.isFinite(price) && price >= 0) {
      next.priceOverrides[id] = { unitPrice: price, source: 'manual', updatedAt: now };
      result.priceUpdates++;
    }

    const status = (row.status ?? '').trim() as ItemStatus;
    if (VALID_STATUS.includes(status)) {
      next.materialOverrides[id] = { ...(next.materialOverrides[id] ?? {}), status };
      result.statusUpdates++;
    }

    const sku = (row.home_depot_sku ?? '').trim();
    if (sku) {
      next.lockedProducts[id] = {
        sku,
        name: (row.name ?? id).trim(),
        unitPrice: Number.isFinite(price) ? price : next.lockedProducts[id]?.unitPrice ?? 0,
        priceSource: 'manual',
        lockedAt: now,
      };
      result.skuUpdates++;
    }

    const term = (row.search_term ?? '').trim();
    if (term) {
      next.materialOverrides[id] = { ...(next.materialOverrides[id] ?? {}), searchTerm: term };
    }
  }

  return { project: next, result };
}

export function importOwnedCsv(project: CoopProject, csvText: string): CoopProject {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const next: CoopProject = JSON.parse(JSON.stringify(project));
  const owned = parsed.data
    .map((row, i) => {
      const name = (row.name ?? '').trim();
      if (!name) return null;
      return {
        id: (row.id ?? `owned-${Date.now()}-${i}`).trim(),
        name,
        quantity: parseFloat(row.quantity ?? '0') || 0,
        unit: (row.unit ?? 'each').trim(),
        matchesMaterialId: (row.matches_material_id ?? '').trim() || undefined,
        estimatedValue: parseFloat(row.estimated_value ?? '') || undefined,
        note: (row.note ?? '').trim() || undefined,
      };
    })
    .filter(Boolean) as CoopProject['ownedMaterials'];
  next.ownedMaterials = owned;
  return next;
}
