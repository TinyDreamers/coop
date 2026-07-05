'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/lib/store/useProjectStore';
import {
  Card,
  CardBody,
  SectionTitle,
  Button,
  Field,
  NumberField,
  Badge,
  cn,
} from '@/components/ui';
import { TOOL_CHECKLIST } from '@/lib/constants';
import {
  downloadBackup,
  readBackupFile,
  exportMaterialsCsv,
  exportCutListCsv,
  exportShoppingCsv,
  exportOwnedCsv,
  importMaterialsCsv,
  importOwnedCsv,
} from '@/lib/csv';
import {
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  FileSpreadsheet,
  Cloud,
  HardDrive,
  RotateCcw,
  LogOut,
  Wrench,
  Save,
} from 'lucide-react';

/**
 * SETTINGS & DATA BACKUP
 *
 * Project-level knobs (name, budget, waste, tax, helpers), free-form notes,
 * the owner's tool checklist, and every import/export/backup path. Everything
 * flows through the same store as the rest of the app — this screen just wires
 * the store actions and the csv helpers to buttons and inputs.
 *
 * Nothing here computes anything itself; it only reads the persisted project +
 * the derived `computed` bundle and calls store actions / csv helpers.
 */
export default function SettingsPage() {
  const router = useRouter();
  const {
    project,
    computed,
    storageMode,
    lastSavedAt,
    saving,
    updateSettings,
    setNotes,
    replaceProject,
    restore,
    reset,
  } = useProjectStore();

  // Transient status messages for the async import/restore flows.
  const [restoreMsg, setRestoreMsg] = useState<Status | null>(null);
  const [materialsMsg, setMaterialsMsg] = useState<Status | null>(null);
  const [ownedMsg, setOwnedMsg] = useState<Status | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Loading is handled by AppShell; bail while the project hydrates.
  if (!project || !computed) return null;

  const { settings } = project;

  // --- Restore from JSON backup -------------------------------------------
  async function handleRestore(file: File | undefined) {
    if (!file) return;
    setRestoreMsg(null);
    try {
      const parsed = await readBackupFile(file);
      restore(parsed);
      setRestoreMsg({ ok: true, text: `Restored "${parsed.name}" from backup.` });
    } catch (e) {
      setRestoreMsg({ ok: false, text: (e as Error).message || 'Could not read that backup file.' });
    }
  }

  // --- Import materials CSV (price / status / SKU overrides) ---------------
  async function handleImportMaterials(file: File | undefined) {
    if (!file || !project || !computed) return;
    setMaterialsMsg(null);
    try {
      const text = await file.text();
      const { project: next, result } = importMaterialsCsv(project, text, computed.materials);
      replaceProject(next);
      setMaterialsMsg({
        ok: true,
        text: `Imported: ${result.priceUpdates} prices, ${result.statusUpdates} statuses, ${result.skuUpdates} SKUs updated.`,
      });
    } catch (e) {
      setMaterialsMsg({ ok: false, text: (e as Error).message || 'Could not import that CSV.' });
    }
  }

  // --- Import owned-materials CSV (replaces the owned inventory) -----------
  async function handleImportOwned(file: File | undefined) {
    if (!file || !project) return;
    setOwnedMsg(null);
    try {
      const text = await file.text();
      const next = importOwnedCsv(project, text);
      replaceProject(next);
      setOwnedMsg({ ok: true, text: `Imported ${next.ownedMaterials.length} owned item(s).` });
    } catch (e) {
      setOwnedMsg({ ok: false, text: (e as Error).message || 'Could not import that CSV.' });
    }
  }

  // --- Danger-zone actions -------------------------------------------------
  function handleReset() {
    if (window.confirm('Reset to the recommended design? This discards all your edits and cannot be undone.')) {
      void reset();
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch {
      /* even if the request fails, send them to the login gate */
    }
    router.push('/login');
  }

  const isCloud = storageMode === 'blob';

  return (
    <div className="space-y-4">
      {/* ---- 1. Project settings ------------------------------------------ */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Project settings"
            subtitle="Budget, waste, tax, and crew assumptions used across every screen."
          />

          <div className="space-y-4">
            <Field label="Project name">
              <input
                className="input"
                value={project.name}
                onChange={(e) => replaceProject({ ...project, name: e.target.value })}
                placeholder="My chicken coop"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Target budget" hint="Drives the budget meter and over-budget warnings.">
                <NumberField
                  value={settings.budget}
                  onChange={(v) => updateSettings({ budget: v })}
                  min={0}
                  step={50}
                  suffix="USD"
                />
              </Field>

              <Field label="Number of helpers" hint="People besides you (used for build-time estimates).">
                <NumberField
                  value={settings.helpers}
                  onChange={(v) => updateSettings({ helpers: Math.max(0, Math.round(v)) })}
                  min={0}
                  max={10}
                  step={1}
                />
              </Field>

              <Field label="Waste factor" hint="Overage added to consumable quantities.">
                {/* Stored as a fraction (0.10) but shown/edited as a percent (10). */}
                <NumberField
                  value={Math.round(settings.wasteFactor * 100)}
                  onChange={(v) => updateSettings({ wasteFactor: Math.max(0, v) / 100 })}
                  min={0}
                  max={50}
                  step={1}
                  suffix="%"
                />
              </Field>

              <Field label="Sales tax rate" hint="NH has no sales tax — leave at 0.">
                {/* Stored as a fraction (0.06) but shown/edited as a percent (6). */}
                <NumberField
                  value={Math.round(settings.salesTaxRate * 10000) / 100}
                  onChange={(v) => updateSettings({ salesTaxRate: Math.max(0, v) / 100 })}
                  min={0}
                  max={20}
                  step={0.5}
                  suffix="%"
                />
              </Field>
            </div>

            <Field label="Store area" hint="Where you'll buy materials — used for pricing context.">
              <input
                className="input"
                value={settings.storeArea}
                onChange={(e) => updateSettings({ storeArea: e.target.value })}
                placeholder="Concord, NH"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* ---- 2. Notes ----------------------------------------------------- */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Notes"
            subtitle="Anything you want to remember — measurements, decisions, reminders."
          />
          <textarea
            className="input"
            rows={4}
            value={project.notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Confirm the run gate swings clear of the compost bin…"
          />
        </CardBody>
      </Card>

      {/* ---- 3. Tool checklist -------------------------------------------- */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Tool checklist"
            subtitle="What this build needs. Green = you already have it."
            right={<Wrench size={18} className="text-timber-400" />}
          />
          <ul className="divide-y divide-timber-100">
            {TOOL_CHECKLIST.map((t) => (
              <li key={t.tool} className="flex items-start gap-3 py-2.5">
                {t.owned ? (
                  <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-moss-600" />
                ) : (
                  <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-amber-500" />
                )}
                <div className="min-w-0">
                  <div className="font-medium text-timber-900">{t.tool}</div>
                  {t.note && <div className="text-xs text-timber-500">{t.note}</div>}
                </div>
                <span className="ml-auto flex-shrink-0">
                  {t.owned ? (
                    <Badge className="bg-moss-100 text-moss-700">Have it</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700">To get</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* ---- 4. Data & backup --------------------------------------------- */}
      <Card>
        <CardBody>
          <SectionTitle
            title="Data & backup"
            subtitle="Download a full backup, restore one, or move data via CSV."
          />

          {/* JSON backup / restore */}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => downloadBackup(project)}>
              <Download size={16} /> Download JSON backup
            </Button>
            <FilePickerButton
              variant="secondary"
              accept="application/json,.json"
              onFile={handleRestore}
            >
              <Upload size={16} /> Restore from backup
            </FilePickerButton>
          </div>
          {restoreMsg && <StatusNote status={restoreMsg} />}

          {/* CSV exports */}
          <div className="mt-4">
            <div className="label">Export CSV</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="ghost" onClick={() => exportMaterialsCsv(computed)}>
                <FileSpreadsheet size={16} /> Materials CSV
              </Button>
              <Button variant="ghost" onClick={() => exportCutListCsv(computed)}>
                <FileSpreadsheet size={16} /> Cut list CSV
              </Button>
              <Button variant="ghost" onClick={() => exportShoppingCsv(computed)}>
                <FileSpreadsheet size={16} /> Shopping list CSV
              </Button>
              <Button variant="ghost" onClick={() => exportOwnedCsv(project)}>
                <FileSpreadsheet size={16} /> Owned materials CSV
              </Button>
            </div>
          </div>

          {/* CSV imports */}
          <div className="mt-4">
            <div className="label">Import CSV</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <FilePickerButton variant="ghost" accept=".csv,text/csv" onFile={handleImportMaterials}>
                <Upload size={16} /> Import materials CSV
              </FilePickerButton>
              <FilePickerButton variant="ghost" accept=".csv,text/csv" onFile={handleImportOwned}>
                <Upload size={16} /> Import owned CSV
              </FilePickerButton>
            </div>
            {materialsMsg && <StatusNote status={materialsMsg} />}
            {ownedMsg && <StatusNote status={ownedMsg} />}
            <p className="mt-2 text-xs text-timber-500">
              Materials import applies prices, statuses, and locked SKUs by matching the{' '}
              <code className="rounded bg-timber-100 px-1">id</code> column from an exported CSV. Owned
              import replaces your entire owned-materials list.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ---- 5. Storage status -------------------------------------------- */}
      <Card>
        <CardBody>
          <SectionTitle title="Storage" subtitle="Where this project is saved." />
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                isCloud ? 'bg-moss-100 text-moss-700' : 'bg-timber-100 text-timber-600',
              )}
            >
              {isCloud ? <Cloud size={20} /> : <HardDrive size={20} />}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-timber-900">
                {isCloud ? 'Vercel Blob cloud storage' : 'This browser (localStorage)'}
              </div>
              <div className="text-sm text-timber-600">
                {saving
                  ? 'Saving…'
                  : lastSavedAt
                    ? `Last saved ${formatTimestamp(lastSavedAt)}`
                    : 'Autosaves on every change.'}
              </div>
              {!isCloud && (
                <p className="mt-2 text-xs text-timber-500">
                  Set the <code className="rounded bg-timber-100 px-1">BLOB_READ_WRITE_TOKEN</code>{' '}
                  environment variable to enable cloud sync across devices. Until then, your data lives
                  only in this browser — use JSON backups to move it.
                </p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ---- 6. Danger zone ----------------------------------------------- */}
      <Card className="border-red-200">
        <CardBody>
          <SectionTitle title="Danger zone" subtitle="These actions can't be undone." />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="danger" onClick={handleReset}>
              <RotateCcw size={16} /> Reset to recommended design
            </Button>
            <Button variant="secondary" onClick={handleLogout} disabled={loggingOut}>
              <LogOut size={16} /> {loggingOut ? 'Logging out…' : 'Log out'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-timber-500">
            Reset discards all of your edits and returns the project to the seeded recommended design.
            Logging out clears the password cookie and returns you to the sign-in screen.
          </p>
        </CardBody>
      </Card>

      {/* Small saving indicator footer (mirrors the rest of the app). */}
      <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-xs text-timber-400">
        <Save size={12} /> Changes save automatically.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

type Status = { ok: boolean; text: string };

/** Inline success / error note beneath an async action. */
function StatusNote({ status }: { status: Status }) {
  return (
    <p
      className={cn(
        'mt-2 flex items-start gap-1.5 text-sm',
        status.ok ? 'text-moss-700' : 'text-red-600',
      )}
    >
      {status.ok ? (
        <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
      ) : (
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
      )}
      <span>{status.text}</span>
    </p>
  );
}

/**
 * A Button that opens a hidden file input and hands the chosen File to `onFile`.
 * Keeps the file-picker plumbing out of the main render and resets the input so
 * picking the same file twice still fires.
 */
function FilePickerButton({
  accept,
  onFile,
  variant = 'secondary',
  children,
}: {
  accept: string;
  onFile: (file: File | undefined) => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={variant} onClick={() => ref.current?.click()}>
        {children}
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </>
  );
}

/** Friendly "Jul 5, 2:14 PM" style timestamp; falls back to the raw string. */
function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
