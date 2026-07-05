import type { CoopProject, CutListItem } from '../types';
import type { Geometry } from './geometry';

const inches = (ft: number) => Math.round(ft * 12);

/**
 * Generate an actionable cut list — the number of PIECES to cut and their
 * finished lengths, grouped by build phase. Quantities here are the real number
 * of cut pieces (the material list separately gives how much stock to buy after
 * waste). Angle notes call out the roof-pitch and bird's-mouth cuts.
 */
export function computeCutList(project: CoopProject, geo: Geometry): CutListItem[] {
  const { coop, run, options } = project;
  const list: CutListItem[] = [];

  const add = (i: Omit<CutListItem, 'id'>) =>
    list.push({ ...i, id: `${i.materialId}:${i.part}:${i.lengthIn}` });

  // --- Foundation / floor (phase 2-3) ---------------------------------
  add({
    part: 'PT skid',
    stock: '4x4 x 12 ft PT',
    lengthIn: inches(coop.widthFt),
    quantity: 3,
    phase: 2,
    materialId: 'lumber.skid-4x4-12-pt',
  });
  const joistCount = Math.ceil((coop.widthFt * 12) / coop.joistSpacingIn) + 1;
  add({
    part: 'Floor joist',
    stock: '2x8 x 8 ft',
    lengthIn: inches(coop.depthFt),
    quantity: joistCount,
    phase: 3,
    materialId: 'lumber.joist-2x8-8',
  });
  add({
    part: 'Rim / band joist',
    stock: '2x8 x 12 ft',
    lengthIn: inches(coop.widthFt),
    quantity: 2,
    phase: 3,
    materialId: 'lumber.rim-2x8-12',
  });

  // --- Coop walls (phase 5) -------------------------------------------
  const studFrontIn = inches(coop.frontWallHeightFt) - 3; // less bottom + top plate
  const studBackIn = inches(coop.backWallHeightFt) - 3;
  const frontStuds = Math.ceil((coop.widthFt * 12) / coop.studSpacingIn) + 1;
  const backStuds = frontStuds;
  const sideStuds = (Math.ceil((coop.depthFt * 12) / coop.studSpacingIn) + 1) * 2;
  add({
    part: 'Front (tall) wall stud',
    stock: '2x4 x 8 ft',
    lengthIn: studFrontIn,
    quantity: frontStuds,
    phase: 5,
    materialId: 'lumber.stud-2x4-8',
  });
  add({
    part: 'Back (short) wall stud',
    stock: '2x4 x 8 ft',
    lengthIn: studBackIn,
    quantity: backStuds,
    phase: 5,
    materialId: 'lumber.stud-2x4-8',
  });
  add({
    part: 'Side wall stud (stepped down the slope)',
    stock: '2x4 x 8 ft',
    lengthIn: studFrontIn,
    quantity: sideStuds,
    phase: 5,
    angleNote: 'Top cut to roof pitch; each stud steps shorter toward the back.',
    materialId: 'lumber.stud-2x4-8',
  });
  add({
    part: 'Wall plate — front/back',
    stock: '2x4 x 12 ft',
    lengthIn: inches(coop.widthFt),
    quantity: 4,
    phase: 5,
    materialId: 'lumber.plate-2x4-12',
  });
  add({
    part: 'Wall plate — sides',
    stock: '2x4 x 12 ft',
    lengthIn: inches(coop.depthFt),
    quantity: 4,
    phase: 5,
    angleNote: 'Side top plates follow the slope.',
    materialId: 'lumber.plate-2x4-12',
  });

  // --- Coop roof (phase 7-8) ------------------------------------------
  const coopRafterCount = Math.ceil((coop.widthFt * 12) / coop.rafterSpacingIn) + 1;
  add({
    part: 'Shed rafter',
    stock: '2x6 x 10 ft',
    lengthIn: Math.round(geo.coopRoofSlopeLengthFt * 12),
    quantity: coopRafterCount,
    phase: 7,
    angleNote: `Bird's-mouth + plumb cut at ${geo.coopRoofPitchPer12.toFixed(1)}:12 pitch.`,
    materialId: 'lumber.rafter-2x6-10',
  });
  // Purlins run the full roof width (width + both overhangs). If that exceeds a
  // 12 ft board, cut two pieces per row and splice the butt joint over a rafter.
  const coopPurlinRows = Math.max(2, Math.ceil(geo.coopRoofSlopeLengthFt / 2));
  const purlinFullIn = inches(coop.widthFt + 2 * coop.roofOverhangFt);
  const purlinSpliced = purlinFullIn > 144;
  add({
    part: 'Roof purlin',
    stock: '2x4 x 12 ft',
    lengthIn: purlinSpliced ? Math.round(purlinFullIn / 2) : purlinFullIn,
    quantity: purlinSpliced ? coopPurlinRows * 2 : coopPurlinRows,
    phase: 7,
    angleNote: purlinSpliced ? 'Two per row — splice the butt joint over a rafter.' : undefined,
    materialId: 'lumber.coop-purlin-2x4-12',
  });

  // --- Roosts (phase 11) ----------------------------------------------
  // Full-width roost bars from 12 ft stock (an 8 ft board can't span a wide coop).
  const roostFt = Math.ceil((options.chickens * 10) / 12);
  const roostBarLenFt = Math.max(2, coop.widthFt - 0.7);
  add({
    part: 'Roost bar (2x4 flat)',
    stock: '2x4 x 12 ft',
    lengthIn: inches(coop.widthFt) - 8,
    quantity: Math.max(2, Math.ceil(roostFt / roostBarLenFt)),
    phase: 11,
    angleNote: 'Mount flat side up; round the top edges for large birds.',
    materialId: 'lumber.roost-2x4-12',
  });

  // --- Run framing (phase 13) -----------------------------------------
  const runDoorFt = run.hasHumanDoor ? run.humanDoorWidthFt : 0;
  const runPanels = Math.max(
    1,
    Math.ceil((geo.runWallPerimeterFt - geo.runSharedWallFt - runDoorFt) / run.panelWidthFt),
  );
  add({
    part: 'Run panel vertical',
    stock: '2x4 x 8 ft',
    lengthIn: Math.round(geo.runAvgWallHeightFt * 12),
    quantity: runPanels * 2,
    phase: 13,
    materialId: 'lumber.run-frame-2x4-8',
  });
  add({
    part: 'Run panel rail (top/mid/bottom)',
    stock: '2x4 x 8 ft',
    lengthIn: inches(run.panelWidthFt),
    quantity: runPanels * 3,
    phase: 13,
    materialId: 'lumber.run-frame-2x4-8',
  });
  add({
    part: 'Run corner / sill post',
    stock: '4x4 x 8 ft PT',
    lengthIn: inches(run.wallHeightFt),
    quantity: 4,
    phase: 13,
    materialId: 'lumber.run-post-4x4-8-pt',
  });

  // --- Run roof (phase 14) --------------------------------------------
  const runRafterCount = Math.ceil((run.lengthFt * 12) / run.rafterSpacingIn) + 1;
  add({
    part: 'Run rafter (over center beam)',
    stock: '2x6 x 16 ft',
    lengthIn: Math.round(geo.runRoofSlopeLengthFt * 12),
    quantity: runRafterCount,
    phase: 14,
    angleNote: 'One piece, supported mid-span by the center beam; cut ends to pitch.',
    materialId: 'lumber.run-rafter-2x6-16',
  });
  add({
    part: 'Run center beam (doubled 2x8)',
    stock: '2x8 x 12 ft',
    lengthIn: 144,
    quantity: Math.ceil(run.lengthFt / 12) * 2,
    phase: 14,
    angleNote: 'Laminate two boards; stagger any butt joints over a post.',
    materialId: 'lumber.run-beam-2x8-12',
  });

  return list;
}
