import type { CoopProject, RoofLayout } from '../types';
import { COOP_FLOOR_HEIGHT_FT } from '../constants';

/**
 * Pure geometric derivations from the editable design. Everything here is a
 * function of dimensions only — no pricing, no materials. Kept separate so it
 * can be unit-tested in isolation and reused by the 3D model.
 *
 * ROOF MODEL — one contiguous shed plane, oriented by `coop.roofLayout`:
 *   footprint is coop (widthW × depth cD) + run (widthW × length rL) stacked
 *   along z, so the combined pad is W wide × (cD + rL) long.
 *
 *   'length': the single plane slopes down the LENGTH (z). High at the coop's
 *             tall gable wall (z=0), unbroken across the coop/run seam, down to
 *             the far run wall (z = cD + rL).
 *   'width' : the single plane slopes across the WIDTH (x). High along one full
 *             length side (x=0), down to the other (x=W). The coop and run share
 *             the same slope end to end.
 *
 * In BOTH modes only two wall heights are free — the coop tall (ridge) wall and
 * the far run (eave) wall; everything else lies ON the plane and is derived, so
 * no wall can ever poke above the roofline. The coop floor is raised, so a coop
 * wall reaches a given roof height a foot lower than the run wall under it.
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

  // --- The single continuous roof plane --------------------------------
  roofLayout: RoofLayout;
  roofWidthFt: number; // structure width the plane spans (x), before overhang
  roofLengthFt: number; // total length (z) = coopDepth + runLength
  roofRunFt: number; // horizontal run the slope happens over (length or width)
  roofRiseFt: number; // ridge(abs) − eave(abs)
  roofPitchPer12: number; // the ONE pitch for the whole roof
  roofSlopePerFt: number; // rise per foot along the slope axis (for roofY(x,z))
  roofAngleRad: number; // slope angle (used by the 3D model)
  roofSlopeLengthFt: number; // ridge-to-eave hypotenuse + eave overhang
  roofAreaSqft: number; // whole roof panel area

  ridgeHeightFt: number; // absolute roof height at the high edge
  eaveHeightFt: number; // absolute roof height at the low edge (before overhang)
  junctionRoofHeightFt: number; // absolute roof height at the coop/run seam (z = cD)

  // Section slope lengths of the SAME plane — what the coop-part and run-part
  // rafters/panels actually span. Kept under the old field names so downstream
  // roof code reads them unchanged.
  coopRoofSlopeLengthFt: number;
  runRoofSlopeLengthFt: number;
  coopRoofAreaSqft: number;
  runRoofAreaSqft: number;
  coopRoofPitchPer12: number; // == roofPitchPer12 (one plane)
  runRoofPitchPer12: number; // == roofPitchPer12 (one plane)

  // Derived wall heights (interior for the raised coop, on-grade for the run).
  coopTallWallFt: number; // coop tall (ridge) wall — a free input
  coopSeamWallFt: number; // coop's shortest wall (on the plane) — derived
  runHighWallFt: number; // run's tallest wall (on the plane) — derived
  runLowWallFt: number; // run's far (eave) wall — derived (capped so it can't exceed the roof)
}

/** Simplify a rise-per-12 number to an "x:12" pitch string. */
export function pitchString(risePer12: number): string {
  return `${Math.round(risePer12 * 10) / 10}:12`;
}

export function computeGeometry(project: CoopProject): Geometry {
  const { coop, run } = project;
  const floor = COOP_FLOOR_HEIGHT_FT;
  const layout: RoofLayout = coop.roofLayout ?? 'length';
  const overhang = coop.roofOverhangFt;

  // --- Footprints -------------------------------------------------------
  const coopAreaSqft = coop.widthFt * coop.depthFt;
  const coopWallPerimeterFt = 2 * (coop.widthFt + coop.depthFt);
  const runAreaSqft = run.widthFt * run.lengthFt;
  const runWallPerimeterFt = 2 * (run.widthFt + run.lengthFt);
  const runSharedWallFt = Math.min(run.widthFt, coop.widthFt);

  // --- The one plane ----------------------------------------------------
  const roofWidthFt = Math.max(coop.widthFt, run.widthFt);
  const roofLengthFt = coop.depthFt + run.lengthFt;
  const roofRunFt = layout === 'length' ? roofLengthFt : roofWidthFt;

  const ridgeHeightFt = floor + coop.frontWallHeightFt; // tall coop wall, on the raised floor
  // Cap the eave strictly below the ridge so the design can never invert (which
  // would poke the far wall above a clamped-flat roof). At least a token slope.
  const eaveHeightFt = Math.min(run.wallHeightFt, ridgeHeightFt - 0.5);
  const roofRiseFt = ridgeHeightFt - eaveHeightFt;
  const roofSlopePerFt = roofRunFt > 0 ? roofRiseFt / roofRunFt : 0;
  const roofPitchPer12 = roofSlopePerFt * 12;
  const roofAngleRad = Math.atan2(roofRiseFt, roofRunFt);
  const cosA = Math.cos(roofAngleRad) || 1;

  // Absolute roof height at a point. The slope axis depends on the layout.
  const roofYAt = (x: number, z: number) =>
    ridgeHeightFt - roofSlopePerFt * (layout === 'length' ? z : x);

  // --- Section slope lengths + areas -----------------------------------
  // 'length': the plane slopes along z, so the coop (cD of z) and run (rL of z)
  //           own different shares of the slope.
  // 'width' : the plane slopes along x, so BOTH the coop and run rafters span the
  //           full width; each section's "slope length" is the same width slope.
  let coopRoofSlopeLengthFt: number;
  let runRoofSlopeLengthFt: number;
  if (layout === 'length') {
    coopRoofSlopeLengthFt = coop.depthFt / cosA;
    runRoofSlopeLengthFt = run.lengthFt / cosA + overhang;
  } else {
    coopRoofSlopeLengthFt = roofWidthFt / cosA + overhang;
    runRoofSlopeLengthFt = roofWidthFt / cosA + overhang;
  }
  const roofSlopeLengthFt = roofRunFt / cosA + overhang;
  const coopRoofAreaSqft =
    layout === 'length'
      ? coopRoofSlopeLengthFt * (roofWidthFt + 2 * overhang)
      : coopRoofSlopeLengthFt * (coop.depthFt + overhang);
  const runRoofAreaSqft =
    layout === 'length'
      ? runRoofSlopeLengthFt * (roofWidthFt + 2 * overhang)
      : runRoofSlopeLengthFt * (run.lengthFt + overhang);
  const roofAreaSqft = coopRoofAreaSqft + runRoofAreaSqft;

  // --- Derived wall heights --------------------------------------------
  const junctionRoofHeightFt = roofYAt(coop.widthFt / 2, coop.depthFt);
  const coopTallWallFt = coop.frontWallHeightFt;
  let coopSeamWallFt: number;
  let runHighWallFt: number;
  const runLowWallFt = eaveHeightFt; // far/low run wall, on grade, exactly on the plane
  if (layout === 'length') {
    // Shortest coop wall is the seam wall (z=cD); tallest run wall is the seam too.
    coopSeamWallFt = Math.max(0, junctionRoofHeightFt - floor);
    runHighWallFt = Math.max(0, junctionRoofHeightFt);
  } else {
    // Slope is across x: the coop's low-side wall (x=W) is its shortest; the
    // run's high-side wall (x=0) reaches the ridge.
    coopSeamWallFt = Math.max(0, eaveHeightFt - floor);
    runHighWallFt = Math.max(0, ridgeHeightFt);
  }

  // --- Wall areas -------------------------------------------------------
  // Coop siding: the tall + short reference walls plus the two sloped walls,
  // approximated by the average of the tall and short coop-wall heights.
  const coopAvgWallFt = (coopTallWallFt + coopSeamWallFt) / 2;
  const coopWallAreaSqft = coopWallPerimeterFt * coopAvgWallFt;
  const coopVolumeCuft = coopAreaSqft * coopAvgWallFt;

  const runAvgWallHeightFt = (runHighWallFt + runLowWallFt) / 2;
  // Hardware-cloth wall area: full run perimeter minus the shared (coop-siding)
  // wall, at the average run wall height.
  const runWallAreaSqft = (runWallPerimeterFt - runSharedWallFt) * runAvgWallHeightFt;

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
    roofLayout: layout,
    roofWidthFt,
    roofLengthFt,
    roofRunFt,
    roofRiseFt,
    roofPitchPer12,
    roofSlopePerFt,
    roofAngleRad,
    roofSlopeLengthFt,
    roofAreaSqft,
    ridgeHeightFt,
    eaveHeightFt,
    junctionRoofHeightFt,
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
