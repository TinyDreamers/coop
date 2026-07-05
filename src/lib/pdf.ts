import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ComputedProject, CoopProject } from './types';
import { MATERIAL_CATEGORIES } from './types';
import { money, inchesToFtIn } from './format';
import { TOOL_CHECKLIST } from './constants';

/**
 * Generate a complete printable build plan PDF using jsPDF + autotable. Includes
 * the project summary, a simplified top-down footprint diagram, warnings,
 * budget, materials + shopping list, cut list, build phases, checklists,
 * locked SKUs, and owner-supplied materials.
 *
 * (We draw a simplified vector footprint rather than embedding a 3D screenshot —
 * it prints cleanly and doesn't depend on a mounted WebGL canvas.)
 */

const MARGIN = 40;

export function generatePlanPdf(project: CoopProject, computed: ComputedProject): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const { metrics, budget, warnings, materials, cutList, phases } = computed;

  let y = MARGIN;

  const heading = (text: string, size = 14) => {
    y = ensureSpace(doc, y, 30, pageH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(83, 55, 40);
    doc.text(text, MARGIN, y);
    y += size + 6;
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  const paragraph = (text: string) => {
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, contentW);
    y = ensureSpace(doc, y, lines.length * 13, pageH);
    doc.text(lines, MARGIN, y);
    y += lines.length * 13 + 4;
  };

  // ---- Title ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(83, 55, 40);
  doc.text('Chicken Coop Build Plan', MARGIN, y);
  y += 26;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `${project.name}  ·  ${project.settings.storeArea}  ·  ${new Date().toLocaleDateString()}`,
    MARGIN,
    y,
  );
  y += 22;

  // ---- Summary stats table ----
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [115, 79, 48] },
    head: [['Metric', 'Value', 'Metric', 'Value']],
    body: [
      ['Flock', `${project.options.chickens} large birds`, 'Coop', `${project.coop.widthFt}×${project.coop.depthFt} ft (${metrics.coopAreaSqft} sf)`],
      ['Coop / bird', `${metrics.coopAreaPerBird} sf`, 'Run', `${project.run.widthFt}×${project.run.lengthFt} ft (${metrics.runAreaSqft} sf)`],
      ['Run / bird', `${metrics.runAreaPerBird} sf`, 'Roost', `${metrics.roostLinearFt} ft (need ${metrics.requiredRoostFt})`],
      ['Nest boxes', `${metrics.nestingBoxes} (need ${metrics.requiredNestingBoxes})`, 'Coop roof', metrics.coopRoofPitch],
      ['Budget', money(budget.budget), 'Estimated total', money(budget.total)],
    ],
    margin: { left: MARGIN, right: MARGIN },
  });
  y = afterTable(doc, y);

  // ---- Footprint diagram ----
  heading('Layout (top-down footprint)');
  y = drawFootprint(doc, project, y, contentW, pageH);

  // ---- Recommended design ----
  heading('Design summary');
  paragraph(
    `Walk-in ${project.coop.widthFt}×${project.coop.depthFt} ft coop on pressure-treated skids + deck blocks (movable, no post holes). ` +
      `${project.coop.frontWallHeightFt} ft front / ${project.coop.backWallHeightFt} ft back shed roof (${metrics.coopRoofPitch}) in ${project.coop.roofMaterial.replace('corrugated-', 'corrugated ')}. ` +
      `Owner-supplied waterproof vinyl plank over a 3/4" subfloor. ${project.options.nestingBoxCount} outside-access ${project.options.nestingBoxType.replace('-', ' ')} nesting boxes. ` +
      `${project.coop.hasAutoChickenDoor ? 'Automatic chicken door. ' : ''}` +
      `Attached ${project.run.widthFt}×${project.run.lengthFt} ft covered run with modular bolt-together panels, 1/2" hardware cloth throughout, ` +
      `${project.options.antiDig === 'apron' ? `${project.options.antiDigApronFt} ft anti-dig apron` : project.options.antiDig + ' anti-dig'}, and suspended feeders. ` +
      `Heated water${project.options.heatedWater ? '' : ' (off)'} via an outdoor GFCI extension cord.`,
  );

  // ---- Warnings ----
  heading('Design checks & warnings');
  if (warnings.length === 0) {
    paragraph('No blocking issues — space, structure, and predator-proofing checks pass.');
  } else {
    autoTable(doc, {
      startY: y,
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [115, 79, 48] },
      head: [['Severity', 'Issue', 'Detail / fix']],
      body: warnings.map((w) => [w.severity.toUpperCase(), w.title, `${w.detail}${w.fix ? '  →  ' + w.fix : ''}`]),
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 120 } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = afterTable(doc, y);
  }

  // ---- Budget by category ----
  heading('Budget');
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [31, 99, 235] },
    head: [['Category', 'Cost']],
    body: [
      ...budget.byCategory.map((c) => [c.label, money(c.total)]),
      ['Subtotal', money(budget.materialsSubtotal)],
      ['Tax', money(budget.tax)],
      ['TOTAL', money(budget.total)],
      ['Target', money(budget.budget)],
      [budget.overBudget ? 'OVER by' : 'Remaining', money(Math.abs(budget.remaining))],
    ],
    margin: { left: MARGIN, right: MARGIN },
  });
  y = afterTable(doc, y);

  // ---- Shopping list (grouped) ----
  doc.addPage();
  y = MARGIN;
  heading('Shopping list (to buy)');
  const byCat = MATERIAL_CATEGORIES.map((c) => ({
    label: c.label,
    items: materials.filter((m) => m.category === c.id && m.status === 'need'),
  })).filter((g) => g.items.length > 0);
  autoTable(doc, {
    startY: y,
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [115, 79, 48] },
    head: [['Category', 'Item', 'Qty', 'Unit $', 'Total', 'SKU']],
    body: byCat.flatMap((g) =>
      g.items.map((m) => [g.label, m.name, `${m.qty} ${m.unit}`, money(m.unitPrice), money(m.lineTotal), m.homeDepotSku ?? '']),
    ),
    columnStyles: { 1: { cellWidth: 170 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = afterTable(doc, y);

  // ---- Owner-supplied + locked SKUs ----
  const owned = materials.filter((m) => m.status === 'owned' || m.ownerSupplied);
  if (owned.length) {
    heading('Owner-supplied materials');
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3 },
      head: [['Item', 'Qty']],
      body: owned.map((m) => [m.name, `${m.qty} ${m.unit}`]),
      margin: { left: MARGIN, right: MARGIN },
    });
    y = afterTable(doc, y);
  }
  const locked = Object.entries(project.lockedProducts);
  if (locked.length) {
    heading('Locked Home Depot products');
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 3 },
      head: [['Material', 'SKU', 'Product', 'Price']],
      body: locked.map(([id, p]) => [id, p.sku, p.name, money(p.unitPrice)]),
      margin: { left: MARGIN, right: MARGIN },
    });
    y = afterTable(doc, y);
  }

  // ---- Cut list ----
  doc.addPage();
  y = MARGIN;
  heading('Cut list');
  autoTable(doc, {
    startY: y,
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [115, 79, 48] },
    head: [['Phase', 'Part', 'Stock', 'Length', 'Qty', 'Notes']],
    body: cutList.map((c) => [`${c.phase}`, c.part, c.stock, inchesToFtIn(c.lengthIn), `${c.quantity}`, c.angleNote ?? '']),
    columnStyles: { 5: { cellWidth: 140 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = afterTable(doc, y);

  // ---- Tool checklist ----
  heading('Tools');
  paragraph(
    TOOL_CHECKLIST.map((t) => `${t.owned ? '[have]' : '[need]'} ${t.tool}${t.note ? ` — ${t.note}` : ''}`).join('\n'),
  );

  // ---- Build phases + checklists ----
  doc.addPage();
  y = MARGIN;
  heading('Build phases & checklist');
  for (const ph of phases) {
    heading(`${ph.id}. ${ph.title}  (~${ph.estimatedHours} hr)`, 12);
    paragraph(ph.summary);
    if (ph.tools.length) paragraph(`Tools: ${ph.tools.join(', ')}`);
    if (ph.materials.length) paragraph(`Materials: ${ph.materials.join(', ')}`);
    ph.steps.forEach((s, i) => {
      const key = `${ph.id}:${i}`;
      const done = project.checklist[key] ? '[x]' : '[ ]';
      paragraph(`${done} ${i + 1}. ${s.text}${s.safety ? `  (Safety: ${s.safety})` : ''}`);
    });
    if (ph.commonMistakes.length) paragraph(`Common mistakes: ${ph.commonMistakes.join('; ')}`);
    if (ph.safetyNotes.length) paragraph(`Safety: ${ph.safetyNotes.join('; ')}`);
    y += 4;
  }

  // ---- Footer page numbers ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Coop Planner — page ${i} of ${pageCount}`, pageW / 2, pageH - 20, { align: 'center' });
  }

  doc.save(`coop-plan-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ---- helpers --------------------------------------------------------------

function ensureSpace(doc: jsPDF, y: number, needed: number, pageH: number): number {
  if (y + needed > pageH - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function afterTable(doc: jsPDF, fallbackY: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY;
  return (typeof finalY === 'number' ? finalY : fallbackY) + 18;
}

/** Draw a scaled top-down footprint of the coop + attached run. */
function drawFootprint(doc: jsPDF, project: CoopProject, y: number, contentW: number, pageH: number): number {
  const { coop, run } = project;
  // Footprint: coop (widthFt x depthFt) then run (widthFt x lengthFt) below it.
  const totalW = Math.max(coop.widthFt, run.widthFt);
  const totalL = coop.depthFt + run.lengthFt;
  const maxDrawH = 220;
  const scale = Math.min(contentW / totalW, maxDrawH / totalL);
  const drawH = totalL * scale;
  y = ensureSpace(doc, y, drawH + 30, pageH);

  const x0 = MARGIN + (contentW - totalW * scale) / 2;
  const y0 = y;

  // Coop rectangle
  doc.setDrawColor(115, 79, 48);
  doc.setFillColor(242, 235, 223);
  doc.setLineWidth(1.2);
  doc.rect(x0, y0, coop.widthFt * scale, coop.depthFt * scale, 'FD');
  // Run rectangle
  doc.setFillColor(233, 244, 233);
  doc.rect(x0, y0 + coop.depthFt * scale, run.widthFt * scale, run.lengthFt * scale, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(80, 60, 45);
  doc.text(`COOP ${coop.widthFt}×${coop.depthFt} ft`, x0 + 6, y0 + 14);
  doc.text(`RUN ${run.widthFt}×${run.lengthFt} ft`, x0 + 6, y0 + coop.depthFt * scale + 14);
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7.5);
  doc.text('Shared wall (attached)', x0 + 6, y0 + coop.depthFt * scale - 4);

  return y0 + drawH + 20;
}
