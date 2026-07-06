import type { CoopProject, CutListItem } from '../types';
import { pickLumber, type LumberNominal } from './lumber';
import type { Geometry } from './geometry';

const inches = (ft: number) => Math.round(ft * 12);

/**
 * Generate an actionable cut list — the number of PIECES to cut and their
 * finished lengths, grouped by build phase. Every member whose length depends on
 * a user dimension picks its stock adaptively (see lumber.ts), so a cut is never
 * longer than the board it comes from, and long members are shown as spliced
 * pieces. Quantities here are cut PIECES (the material list gives boards to buy).
 */
export function computeCutList(project: CoopProject, geo: Geometry): CutListItem[] {
  const { coop, run, options } = project;
  const layout = geo.roofLayout; // 'length' or 'width' — which way the one roof slopes
  const list: CutListItem[] = [];

  const add = (i: Omit<CutListItem, 'id'>) =>
    list.push({ ...i, id: `${i.materialId}:${i.part}:${i.lengthIn}:${list.length}` });

  /**
   * Emit a cut for a member of finished length `finishedFt`, cut from stock sized
   * to `stockFt` (usually the same). Splices automatically if the piece exceeds
   * the longest board.
   */
  const member = (opts: {
    part: string;
    nominal: LumberNominal;
    finishedFt: number;
    stockFt?: number;
    count: number;
    phase: number;
    materialId: string;
    angleNote?: string;
  }) => {
    const s = pickLumber(opts.nominal, opts.stockFt ?? opts.finishedFt);
    const spliced = s.pieces > 1;
    const perPieceIn = spliced ? Math.round((opts.finishedFt * 12) / s.pieces) : Math.round(opts.finishedFt * 12);
    const note = spliced
      ? `${opts.angleNote ? opts.angleNote + ' ' : ''}Splice ${s.pieces} pieces over a support.`
      : opts.angleNote;
    add({
      part: opts.part,
      stock: s.label,
      lengthIn: perPieceIn,
      quantity: opts.count * s.pieces,
      phase: opts.phase,
      angleNote: note,
      materialId: opts.materialId,
    });
  };

  // --- Foundation / floor (phase 2-3) ---------------------------------
  member({ part: 'PT skid', nominal: '4x4pt', finishedFt: coop.widthFt, count: 3, phase: 2, materialId: 'lumber.skid-4x4-12-pt' });
  const joistCount = Math.ceil((coop.widthFt * 12) / coop.joistSpacingIn) + 1;
  member({ part: 'Floor joist', nominal: '2x8', finishedFt: coop.depthFt, count: joistCount, phase: 3, materialId: 'lumber.joist-2x8-8' });
  member({ part: 'Rim / band joist', nominal: '2x8', finishedFt: coop.widthFt, count: 2, phase: 3, materialId: 'lumber.rim-2x8-12' });

  // --- Coop walls (phase 5) -------------------------------------------
  // Studs are bought to the tall (ridge) wall; the finished cut is the wall
  // height less the plates. Spacing is snow-load, not human-grade.
  const studStockFt = geo.coopTallWallFt;
  const studTallIn = inches(geo.coopTallWallFt) - 3;
  const studSeamIn = Math.max(inches(geo.coopSeamWallFt) - 3, 6);
  const frontStuds = Math.ceil((coop.widthFt * 12) / coop.studSpacingIn) + 1;
  const sideStuds = (Math.ceil((coop.depthFt * 12) / coop.studSpacingIn) + 1) * 2;
  const studStock = pickLumber('2x4', studStockFt);
  add({ part: 'Tall (ridge) wall stud', stock: studStock.label, lengthIn: studTallIn, quantity: frontStuds, phase: 5, materialId: 'lumber.stud-2x4-8' });
  add({ part: 'Seam wall stud (coop/run side)', stock: studStock.label, lengthIn: studSeamIn, quantity: frontStuds, phase: 5, materialId: 'lumber.stud-2x4-8' });
  add({ part: 'Side wall stud (stepped down the slope)', stock: studStock.label, lengthIn: studTallIn, quantity: sideStuds, phase: 5, angleNote: 'Top cut to roof pitch; each stud steps shorter toward the run seam.', materialId: 'lumber.stud-2x4-8' });

  member({ part: 'Wall plate — front/back', nominal: '2x4', finishedFt: coop.widthFt, count: 4, phase: 5, materialId: 'lumber.plate-2x4-12' });
  member({ part: 'Wall plate — sides', nominal: '2x4', finishedFt: coop.depthFt, count: 4, phase: 5, materialId: 'lumber.plate-2x4-12', angleNote: 'Side top plates follow the slope.' });

  // --- Coop roof (phase 7-8) ------------------------------------------
  const coopRafterCount =
    (layout === 'length'
      ? Math.ceil((coop.widthFt * 12) / coop.rafterSpacingIn)
      : Math.ceil((coop.depthFt * 12) / coop.rafterSpacingIn)) + 1;
  member({
    part: 'Shed rafter',
    nominal: '2x6',
    finishedFt: geo.coopRoofSlopeLengthFt,
    count: coopRafterCount,
    phase: 7,
    materialId: 'lumber.rafter-2x6-10',
    angleNote: `Bird's-mouth + plumb cut at ${geo.roofPitchPer12.toFixed(1)}:12 pitch.`,
  });
  const coopPurlinRows = Math.max(2, Math.ceil(geo.coopRoofSlopeLengthFt / 2));
  member({
    part: 'Roof purlin',
    nominal: '2x4',
    finishedFt: layout === 'length' ? coop.widthFt + 2 * coop.roofOverhangFt : coop.depthFt,
    count: coopPurlinRows,
    phase: 7,
    materialId: 'lumber.coop-purlin-2x4-12',
    angleNote: 'Runs across the rafters.',
  });

  // --- Roosts (phase 11) ----------------------------------------------
  const roostFt = Math.ceil((options.chickens * 10) / 12);
  const roostBarLenFt = Math.max(2, coop.widthFt - 0.7);
  const roostBars = Math.max(2, Math.ceil(roostFt / roostBarLenFt));
  member({
    part: 'Roost bar (2x4 flat)',
    nominal: '2x4',
    finishedFt: roostBarLenFt,
    count: roostBars,
    phase: 11,
    materialId: 'lumber.roost-2x4-12',
    angleNote: 'Mount flat side up; round the top edges for large birds.',
  });

  // --- Run framing (phase 13) -----------------------------------------
  const runDoorFt = run.hasHumanDoor ? run.humanDoorWidthFt : 0;
  const runPanels = Math.max(
    1,
    Math.ceil((geo.runWallPerimeterFt - geo.runSharedWallFt - runDoorFt) / run.panelWidthFt),
  );
  // Verticals span the wall height (bought to the tall side); rails span a panel.
  const runVertStock = pickLumber('2x4', geo.runHighWallFt);
  add({
    part: 'Run panel vertical',
    stock: runVertStock.label,
    lengthIn: Math.round(geo.runAvgWallHeightFt * 12),
    quantity: runPanels * 2,
    phase: 13,
    angleNote: 'Coop-seam side full height; far side cut down to the slope.',
    materialId: 'lumber.run-frame-2x4-8',
  });
  member({ part: 'Run panel rail (top/mid/bottom)', nominal: '2x4', finishedFt: run.panelWidthFt, count: runPanels * 3, phase: 13, materialId: 'lumber.run-frame-2x4-8' });
  member({ part: 'Run corner / sill post', nominal: '4x4pt', finishedFt: geo.runHighWallFt, count: 4, phase: 13, materialId: 'lumber.run-post-4x4-8-pt', angleNote: 'Coop-seam corners full height; far corners cut down.' });

  // --- Run roof (phase 14) — the run's share of the continuous roof ----
  const runRafterCount =
    (layout === 'length'
      ? Math.ceil((run.widthFt * 12) / run.rafterSpacingIn)
      : Math.ceil((run.lengthFt * 12) / run.rafterSpacingIn)) + 1;
  member({
    part: 'Run rafter (down the slope)',
    nominal: '2x6',
    finishedFt: geo.runRoofSlopeLengthFt,
    count: runRafterCount,
    phase: 14,
    materialId: 'lumber.run-rafter-2x6-16',
    angleNote: 'Runs down the shared slope; jointed over the beam; cut ends to pitch.',
  });
  if (layout === 'length') {
    // Cross-beams across the width every ~8 ft (omitted when the run needs none).
    const runBeamLines = Math.max(0, Math.ceil(run.lengthFt / 8) - 1);
    if (runBeamLines > 0) {
      member({
        part: 'Run roof cross-beam (doubled 2x8)',
        nominal: '2x8',
        finishedFt: run.widthFt,
        count: runBeamLines * 2,
        phase: 14,
        materialId: 'lumber.run-beam-2x8-12',
        angleNote: 'Laminate two boards; runs across the width; stagger butt joints over a post.',
      });
    }
  } else {
    // One center beam down the length carries the width-spanning rafters.
    member({
      part: 'Run roof center beam (doubled 2x8)',
      nominal: '2x8',
      finishedFt: run.lengthFt,
      count: 2,
      phase: 14,
      materialId: 'lumber.run-beam-2x8-12',
      angleNote: 'Laminate two boards down the run length; stagger butt joints over a post.',
    });
  }

  return list;
}
