import type { CoopProject } from '../types';
import { COOP_FLOOR_HEIGHT_FT } from '../constants';

/**
 * Pure geometric derivations from the editable design. Everything here is a
 * function of dimensions only — no pricing, no materials. Kept separate so it
 * can be unit-tested in isolation and reused by the 3D model.
 *
 * ROOF MODEL — one contiguous shed roof.
 * The coop and run share a SINGLE monopitch plane that slopes down the LENGTH:
 * high at the coop's tall gable wall (z = 0), unbroken across the coop/run seam,
 * down to the far run wall (z = coopDepth + runLength). Because it is one plane,
 * only two wall heights are free — the coop's tall wall (ridge) and the far run
 * wall (eave); the two seam walls are DERIVED so the plane never steps. The
 * coop sits on a raised floor, so a coop wall reaches a given roof height a foot
 * lower than the run wall beneath the same point.
 */
export interface Geometry {
  // Coop footprint
  coopAreaSqft: number;
  coopWallPerimeterFt: number;
  coopWallAreaSqft: number; // gross exterior wall area (for siding)
  coopVolumeCuft: number;

  // Run footprint
  runAreaSqft: number;
  runWallPerimeterFt: number;
  runSharedWallFt: number; // wall shared with the coop (no hardware cloth there)
  runWallAreaSqft: number; // gross wall area to cover in hardware cloth
  runAvgWallHeightFt: number;

  // --- Single continuous roof plane (slopes down the length) -------------
  roofWidthFt: number; // structure width the roof spans (x), before overhang
  roofTotalRunFt: number; // horizontal run of the whole slope = coopDepth + runLength
  roofRiseFt: number; // ridge(abs) − eave(abs)
  roofPitchPer12: number; // the ONE pitch for the whole roof
  roofAngleRad: number; // slope angle (used by the 3D model)
  roofSlopeLengthFt: number; // full ridge-to-eave hypotenuse + low-eave overhang
  roofAreaSqft: number; // whole roof panel area

  ridgeHeightFt: number; // absolute roof height at z = 0 (over the coop tall wall)
  junctionRoofHeightFt: number; // absolute roof height at z = coopDepth (coop/run seam)
  eaveHeightFt: number; // absolute roof height at the far run wall

  // Section slope lengths of the SAME plane (kept under the old field names so
  // the coop/run material + cut-list code reads them unchanged).
  coopRoofSlopeLengthFt: number; // ridge → seam (the coop's share of the slope)
  runRoofSlopeLengthFt: number; // seam → eave (the run's share, incl. overhang)
  coopRoofAreaSqft: number;
  runRoofAreaSqft: number;
  coopRoofPitchPer12: number; // == roofPitchPer12 (one plane)
  runRoofPitchPer12: number; // == roofPitchPer12 (one plane)

  // Derived wall heights on the single plane.
  coopTallWallFt: number; // coop tall (ridge) gable wall — a free input
  coopSeamWallFt: number; // coop wall at the run seam — derived
  runHighWallFt: number; // run wall at the coop seam (on grade) — derived
  runLowWallFt: number; // far run (eave) wall — a free input
}

/** Simplify a rise-per-12 number to an "x:12" pitch string. */
export function pitchString(risePer12: number): string {
  return `${Math.round(risePer12 * 10) / 10}:12`;
}

export function computeGeometry(project: CoopProject): Geometry {
  const { coop, run } = project;
  const floor = COOP_FLOOR_HEIGHT_FT;

  // --- Footprints -------------------------------------------------------
  const coopAreaSqft = coop.widthFt * coop.depthFt;
  const coopWallPerimeterFt = 2 * (coop.widthFt + coop.depthFt);
  const runAreaSqft = run.widthFt * run.lengthFt;
  const runWallPerimeterFt = 2 * (run.widthFt + run.lengthFt);
  // The run attaches to the coop along one wall (the shared face is the narrower
  // of the two matching widths); that side is solid coop siding, never wire.
  const runSharedWallFt = Math.min(run.widthFt, coop.widthFt);

  // --- One continuous shed plane down the length ------------------------
  const roofWidthFt = Math.max(coop.widthFt, run.widthFt);
  const roofTotalRunFt = coop.depthFt + run.lengthFt;
  const ridgeHeightFt = floor + coop.frontWallHeightFt; // tall coop wall, on the raised floor
  const eaveHeightFt = run.wallHeightFt; // far run wall, on grade
  const roofRiseFt = Math.max(0, ridgeHeightFt - eaveHeightFt);
  const slopePerFt = roofTotalRunFt > 0 ? roofRiseFt / roofTotalRunFt : 0;
  const roofPitchPer12 = slopePerFt * 12;
  const roofAngleRad = Math.atan2(roofRiseFt, roofTotalRunFt);
  const cosA = Math.cos(roofAngleRad) || 1;

  const roofYAt = (z: number) => ridgeHeightFt - slopePerFt * z;
  const junctionRoofHeightFt = roofYAt(coop.depthFt);

  // Slope lengths of each section of the single plane. Only the low (far run)
  // eave carries an overhang; the coop end is the ridge.
  const coopRoofSlopeLengthFt = coop.depthFt / cosA;
  const runRoofSlopeLengthFt = run.lengthFt / cosA + coop.roofOverhangFt;
  const roofSlopeLengthFt = coopRoofSlopeLengthFt + runRoofSlopeLengthFt;
  const roofPanelWidthFt = roofWidthFt + 2 * coop.roofOverhangFt;
  const coopRoofAreaSqft = coopRoofSlopeLengthFt * roofPanelWidthFt;
  const runRoofAreaSqft = runRoofSlopeLengthFt * roofPanelWidthFt;
  const roofAreaSqft = roofSlopeLengthFt * roofPanelWidthFt;

  // --- Derived wall heights --------------------------------------------
  const coopTallWallFt = coop.frontWallHeightFt;
  const coopSeamWallFt = Math.max(0, junctionRoofHeightFt - floor);
  const runHighWallFt = Math.max(0, junctionRoofHeightFt); // run is on grade
  const runLowWallFt = run.wallHeightFt;

  // --- Wall areas -------------------------------------------------------
  // Coop: tall gable (z=0) + seam wall (z=depth), both full-width rectangles,
  // plus the two side walls whose tops slope from tall → seam (trapezoids).
  const coopWallAreaSqft =
    coop.widthFt * coopTallWallFt +
    coop.widthFt * coopSeamWallFt +
    2 * coop.depthFt * ((coopTallWallFt + coopSeamWallFt) / 2);
  const coopVolumeCuft = coopAreaSqft * ((coopTallWallFt + coopSeamWallFt) / 2);

  const runAvgWallHeightFt = (runHighWallFt + runLowWallFt) / 2;
  // Hardware-cloth wall area: far end wall + the two sloped side walls. The seam
  // wall against the coop is solid coop siding, so it is excluded.
  const runWallAreaSqft =
    run.widthFt * runLowWallFt + 2 * run.lengthFt * runAvgWallHeightFt;

  return {
    coopAreaSqft,
    coopWallPerimeterFt,
    coopWallAreaSqft,
    coopVolumeCuft,
    runAreaSqft,
    runWallPerimeterFt,
    runSharedWallFt,
    runWallAreaSqft,
    runAvgWallHeightFt,
    roofWidthFt,
    roofTotalRunFt,
    roofRiseFt,
    roofPitchPer12,
    roofAngleRad,
    roofSlopeLengthFt,
    roofAreaSqft,
    ridgeHeightFt,
    junctionRoofHeightFt,
    eaveHeightFt,
    coopRoofSlopeLengthFt,
    runRoofSlopeLengthFt,
    coopRoofAreaSqft,
    runRoofAreaSqft,
    coopRoofPitchPer12: roofPitchPer12,
    runRoofPitchPer12: roofPitchPer12,
    coopTallWallFt,
    coopSeamWallFt,
    runHighWallFt,
    runLowWallFt,
  };
}
