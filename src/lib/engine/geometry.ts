import type { CoopProject } from '../types';

/**
 * Pure geometric derivations from the editable design. Everything here is a
 * function of dimensions only — no pricing, no materials. Kept separate so it
 * can be unit-tested in isolation and reused by the 3D model.
 */
export interface Geometry {
  // Coop
  coopAreaSqft: number;
  coopWallPerimeterFt: number;
  coopRoofRun: number; // horizontal run of the shed slope (= depth + overhang)
  coopRoofRise: number; // vertical rise across the slope
  coopRoofSlopeLengthFt: number; // hypotenuse (actual panel length needed)
  coopRoofAreaSqft: number;
  coopRoofPitchPer12: number; // rise per 12 of run
  coopWallAreaSqft: number; // gross exterior wall area (for siding)
  coopVolumeCuft: number;

  // Run
  runAreaSqft: number;
  runWallPerimeterFt: number;
  runSharedWallFt: number; // wall shared with the coop (no hardware cloth there)
  runRoofRun: number;
  runRoofRise: number;
  runRoofSlopeLengthFt: number;
  runRoofAreaSqft: number;
  runRoofPitchPer12: number;
  runWallAreaSqft: number; // gross wall area to cover in hardware cloth
  runAvgWallHeightFt: number;
}

/** Simplify a rise-per-12 number to an "x:12" pitch string. */
export function pitchString(risePer12: number): string {
  return `${Math.round(risePer12 * 10) / 10}:12`;
}

export function computeGeometry(project: CoopProject): Geometry {
  const { coop, run } = project;

  // --- Coop -------------------------------------------------------------
  const coopAreaSqft = coop.widthFt * coop.depthFt;
  const coopWallPerimeterFt = 2 * (coop.widthFt + coop.depthFt);

  // Pitch is rise over the STRUCTURAL run (wall-to-wall depth), not including
  // the overhang. The overhang continues the roof plane at the same slope.
  const coopRoofRun = coop.depthFt; // wall-to-wall run the rise happens over
  const coopRoofRise = Math.max(0, coop.frontWallHeightFt - coop.backWallHeightFt);
  const coopRoofPitchPer12 = coopRoofRun > 0 ? (coopRoofRise / coopRoofRun) * 12 : 0;
  // Panel length = slope across the walls + the overhang carried along the slope.
  const coopRoofSlopeLengthFt =
    Math.sqrt(coopRoofRun * coopRoofRun + coopRoofRise * coopRoofRise) + coop.roofOverhangFt;
  // Roof covers full width + overhangs on both ends.
  const coopRoofWidth = coop.widthFt + 2 * coop.roofOverhangFt;
  const coopRoofAreaSqft = coopRoofSlopeLengthFt * coopRoofWidth;

  // Two side walls are trapezoids (front & back heights); front/back walls are
  // rectangles at their respective heights. Approximate gross wall area.
  const avgCoopHeight = (coop.frontWallHeightFt + coop.backWallHeightFt) / 2;
  const coopWallAreaSqft =
    2 * (coop.depthFt * avgCoopHeight) + // the two sloped side walls (trapezoids)
    coop.widthFt * coop.frontWallHeightFt + // tall wall
    coop.widthFt * coop.backWallHeightFt; // short wall
  const coopVolumeCuft = coopAreaSqft * avgCoopHeight;

  // --- Run --------------------------------------------------------------
  const runAreaSqft = run.widthFt * run.lengthFt;
  const runWallPerimeterFt = 2 * (run.widthFt + run.lengthFt);
  // The run attaches to the coop along one wall; that shared face is the coop
  // wall (width of the shorter matching dimension). Use the coop width if the
  // run's shared side matches, else the run width.
  const runSharedWallFt = Math.min(run.widthFt, project.coop.widthFt);

  const runRoofRun = run.widthFt; // slope runs across the width
  const runRoofRise = Math.max(0, run.highWallHeightFt - run.wallHeightFt);
  const runRoofPitchPer12 = runRoofRun > 0 ? (runRoofRise / runRoofRun) * 12 : 0;
  const runRoofSlopeLengthFt =
    Math.sqrt(runRoofRun * runRoofRun + runRoofRise * runRoofRise) + run.roofOverhangFt;
  const runRoofWidth = run.lengthFt + 2 * run.roofOverhangFt;
  const runRoofAreaSqft = runRoofSlopeLengthFt * runRoofWidth;

  const runAvgWallHeightFt = (run.highWallHeightFt + run.wallHeightFt) / 2;
  // Gross wall area to wrap in hardware cloth: full perimeter minus the shared
  // wall (that side is solid coop siding). Two end walls carry the slope, so use
  // the average height around the perimeter as a close approximation.
  const runWallAreaSqft = (runWallPerimeterFt - runSharedWallFt) * runAvgWallHeightFt;

  return {
    coopAreaSqft,
    coopWallPerimeterFt,
    coopRoofRun,
    coopRoofRise,
    coopRoofSlopeLengthFt,
    coopRoofAreaSqft,
    coopRoofPitchPer12,
    coopWallAreaSqft,
    coopVolumeCuft,
    runAreaSqft,
    runWallPerimeterFt,
    runSharedWallFt,
    runRoofRun,
    runRoofRise,
    runRoofSlopeLengthFt,
    runRoofAreaSqft,
    runRoofPitchPer12,
    runWallAreaSqft,
    runAvgWallHeightFt,
  };
}
