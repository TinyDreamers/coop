'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { Card, CardBody, SectionTitle, Button, EmptyState } from '@/components/ui';
import {
  exportMaterialsCsv,
  exportShoppingCsv,
  exportCutListCsv,
  exportOwnedCsv,
  downloadBackup,
  readBackupFile,
} from '@/lib/csv';
import { generatePlanPdf } from '@/lib/pdf';
import type { ExportRecord } from '@/lib/types';
import { FileText, FileDown, Printer, DatabaseBackup, Upload, Table2, History } from 'lucide-react';

export default function ExportPage() {
  const { project, computed, replaceProject, restore } = useProjectStore();
  const restoreRef = useRef<HTMLInputElement>(null);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!project || !computed) return null;

  function logExport(kind: ExportRecord['kind'], label: string) {
    const rec: ExportRecord = {
      id: `exp-${Date.now()}`,
      kind,
      label,
      createdAt: new Date().toISOString(),
    };
    replaceProject({ ...project!, exportHistory: [rec, ...project!.exportHistory].slice(0, 30) });
  }

  async function doPdf() {
    setBusy(true);
    try {
      generatePlanPdf(project!, computed!);
      logExport('pdf', 'Full build plan PDF');
    } finally {
      setBusy(false);
    }
  }

  async function onRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreErr(null);
    try {
      const p = await readBackupFile(file);
      restore(p);
    } catch (err) {
      setRestoreErr((err as Error).message);
    } finally {
      if (restoreRef.current) restoreRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      {/* PDF + print */}
      <Card>
        <CardBody>
          <SectionTitle title="Full plan" subtitle="Everything in one document to print or share" />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={doPdf} disabled={busy}>
              <FileText size={16} /> {busy ? 'Building PDF…' : 'Download PDF plan'}
            </Button>
            <Link href="/print" className="btn-secondary" onClick={() => logExport('pdf', 'Printable plan view')}>
              <Printer size={16} /> Printable page (Save as PDF)
            </Link>
          </div>
          <p className="mt-2 text-xs text-timber-500">
            The PDF includes the summary, footprint diagram, warnings, budget, shopping list, cut list, build
            phases + checklists, tools, owner-supplied materials, and locked SKUs.
          </p>
        </CardBody>
      </Card>

      {/* CSV exports */}
      <Card>
        <CardBody>
          <SectionTitle title="CSV export" subtitle="For spreadsheets & backups" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="secondary" onClick={() => { exportMaterialsCsv(computed); logExport('csv', 'Materials CSV'); }}>
              <Table2 size={15} /> Materials
            </Button>
            <Button variant="secondary" onClick={() => { exportShoppingCsv(computed); logExport('csv', 'Shopping CSV'); }}>
              <Table2 size={15} /> Shopping
            </Button>
            <Button variant="secondary" onClick={() => { exportCutListCsv(computed); logExport('csv', 'Cut list CSV'); }}>
              <Table2 size={15} /> Cut list
            </Button>
            <Button variant="secondary" onClick={() => { exportOwnedCsv(project); logExport('csv', 'Owned CSV'); }}>
              <Table2 size={15} /> Owned
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Backup / restore */}
      <Card>
        <CardBody>
          <SectionTitle title="Backup & restore" subtitle="Full project as a JSON file" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { downloadBackup(project); logExport('backup', 'JSON backup'); }}>
              <DatabaseBackup size={16} /> Download backup (.json)
            </Button>
            <Button variant="secondary" onClick={() => restoreRef.current?.click()}>
              <Upload size={16} /> Restore from backup
            </Button>
            <input ref={restoreRef} type="file" accept="application/json,.json" className="hidden" onChange={onRestore} />
          </div>
          {restoreErr && <p className="mt-2 text-sm text-red-600">{restoreErr}</p>}
          <p className="mt-2 text-xs text-timber-500">
            Restoring replaces your current project. Download a backup first if unsure.
          </p>
        </CardBody>
      </Card>

      {/* History */}
      <Card>
        <CardBody>
          <SectionTitle title="Export history" right={<History size={16} className="text-timber-400" />} />
          {project.exportHistory.length === 0 ? (
            <EmptyState icon={<FileDown size={28} />} title="No exports yet">
              Your PDF, CSV, and backup exports will be listed here.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-timber-100">
              {project.exportHistory.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium text-timber-800">{h.label}</span>
                  <span className="text-xs text-timber-500">
                    {new Date(h.createdAt).toLocaleString()} · {h.kind.toUpperCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
