import type { ComputedProject, CoopProject, DesignMetrics } from '../types';
import {
  BIRDS_PER_NESTING_BOX,
  ROOST_IN_PER_BIRD,
  SQFT_PER_BIRD_COOP,
  SQFT_PER_BIRD_RUN,
  VENT_SQFT_PER_BIRD,
} from '../constants';
import { computeGeometry, pitchString, type Geometry } from './geometry';
import { computeMaterials } from './materials';
import { computeBudget } from './budget';
import { computeCutList } from './cutlist';
import { computeWarnings } from './warnings';
import { computePhases } from './phases';
import { computeComponents } from './components3d';

export * from './geometry';
export { computeMaterials } from './materials';
export { computeBudget } from './budget';
export { computeCutList } from './cutlist';
export { computeWarnings } from './warnings';
export { computePhases } from './phases';
export { computeComponents } from './components3d';

/**
 * Headline design metrics — cheap to compute, used on the dashboard and by the
 * warning engine. Depends only on geometry + options.
 */
export function computeMetrics(project: CoopProject, geo: Geometry): DesignMetrics {
  const { options, coop } = project;
  const birds = options.chickens;

  const roostLinearFt = (() => {
    // Roost feet derived the same way the material line is (10" per bird target,
    // provided as whole 2x4 bars spanning ~ the coop width).
    const target = (birds * ROOST_IN_PER_BIRD) / 12;
    return Math.round(target * 10) / 10;
  })();

  const requiredRoostFt = Math.round(((birds * ROOST_IN_PER_BIRD) / 12) * 10) / 10;
  const actualVentSqft = coop.ventLinearFt * 1; // ~1 ft tall vent strips
  const requiredVentSqft = Math.round(birds * VENT_SQFT_PER_BIRD * 10) / 10;

  return {
    coopAreaSqft: Math.round(geo.coopAreaSqft * 10) / 10,
    coopAreaPerBird: Math.round((geo.coopAreaSqft / birds) * 100) / 100,
    runAreaSqft: Math.round(geo.runAreaSqft * 10) / 10,
    runAreaPerBird: Math.round((geo.runAreaSqft / birds) * 100) / 100,
    roostLinearFt,
    roostLinearFtPerBird: Math.round((roostLinearFt / birds) * 12 * 10) / 10, // inches/bird
    requiredRoostFt,
    nestingBoxes: options.nestingBoxCount,
    requiredNestingBoxes: Math.ceil(birds / BIRDS_PER_NESTING_BOX),
    coopRoofPitch: pitchString(geo.coopRoofPitchPer12),
    runRoofPitch: pitchString(geo.runRoofPitchPer12),
    ventLinearFt: coop.ventLinearFt,
    requiredVentSqft,
    actualVentSqft,
  };
}

/**
 * THE top-level engine call. Given the persisted project document, produce the
 * entire derived bundle: geometry, materials, cut list, budget, warnings,
 * phases, and 3D components. Everything the UI renders flows from here.
 */
export function computeProject(project: CoopProject): ComputedProject {
  const geometry = computeGeometry(project);
  const metrics = computeMetrics(project, geometry);
  const materials = computeMaterials(project, geometry);
  const budget = computeBudget(project, materials);
  const cutList = computeCutList(project, geometry);
  const warnings = computeWarnings(project, geometry, metrics, budget, materials);
  const phases = computePhases(project, geometry);
  const components = computeComponents(project, geometry, materials);

  return { geometry, materials, cutList, budget, warnings, phases, components, metrics };
}

// Re-export the metric constants for UI display.
export {
  SQFT_PER_BIRD_COOP,
  SQFT_PER_BIRD_RUN,
  ROOST_IN_PER_BIRD,
  BIRDS_PER_NESTING_BOX,
};
