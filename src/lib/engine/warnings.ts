import type {
  BudgetSummary,
  CoopProject,
  DesignMetrics,
  MaterialItem,
  Warning,
} from '../types';
import {
  MAX_UNSUPPORTED_RAFTER_SPAN_FT,
  MIN_ROOF_PITCH_RISE_PER_12,
  RECOMMENDED_ROOF_PITCH_RISE_PER_12,
  SQFT_PER_BIRD_COOP,
  SQFT_PER_BIRD_RUN,
  WEAK_WIRE_TYPES,
} from '../constants';
import type { Geometry } from './geometry';

const fmt = (n: number) => Math.round(n * 10) / 10;

/**
 * Generate the design validation warnings. These are practical structural,
 * space, predator, ventilation, and electrical checks — NOT permit/code
 * compliance. Each warning has a severity and an actionable fix.
 */
export function computeWarnings(
  project: CoopProject,
  geo: Geometry,
  metrics: DesignMetrics,
  budget: BudgetSummary,
  materials: MaterialItem[],
): Warning[] {
  const w: Warning[] = [];
  const { options, coop, run } = project;

  // ---- SPACE ----------------------------------------------------------
  if (metrics.coopAreaPerBird < SQFT_PER_BIRD_COOP) {
    w.push({
      id: 'coop-space',
      severity: 'error',
      category: 'space',
      title: 'Coop is too small for the flock',
      detail: `You have ${fmt(metrics.coopAreaSqft)} sq ft = ${fmt(
        metrics.coopAreaPerBird,
      )} sq ft/bird. Large breeds need ${SQFT_PER_BIRD_COOP} sq ft/bird → ${
        options.chickens * SQFT_PER_BIRD_COOP
      } sq ft for ${options.chickens} birds.`,
      fix: `Increase the coop to at least ${Math.ceil(
        (options.chickens * SQFT_PER_BIRD_COOP) / coop.widthFt,
      )} ft deep, or reduce the flock.`,
    });
  }
  if (metrics.runAreaPerBird < SQFT_PER_BIRD_RUN) {
    w.push({
      id: 'run-space',
      severity: metrics.runAreaPerBird < SQFT_PER_BIRD_RUN * 0.8 ? 'error' : 'warning',
      category: 'space',
      title: 'Run is tight for the flock',
      detail: `Run is ${fmt(metrics.runAreaSqft)} sq ft = ${fmt(
        metrics.runAreaPerBird,
      )} sq ft/bird. Aim for ${SQFT_PER_BIRD_RUN}+ sq ft/bird (${
        options.chickens * SQFT_PER_BIRD_RUN
      } sq ft) to avoid boredom/pecking.`,
      fix: 'Lengthen the run or free-range part of the day.',
    });
  }
  if (metrics.roostLinearFt < metrics.requiredRoostFt) {
    w.push({
      id: 'roost-space',
      severity: 'warning',
      category: 'space',
      title: 'Not enough roost length',
      detail: `You have ${fmt(metrics.roostLinearFt)} ft of roost; ${
        options.chickens
      } large birds need ~${fmt(metrics.requiredRoostFt)} ft (10 in each).`,
      fix: 'Add another roost bar. Keep all roosts at the same height to prevent squabbles.',
    });
  }
  if (metrics.nestingBoxes < metrics.requiredNestingBoxes) {
    w.push({
      id: 'nesting-count',
      severity: 'warning',
      category: 'space',
      title: 'Too few nesting boxes',
      detail: `${metrics.nestingBoxes} boxes for ${options.chickens} hens. Provide 1 per 3-4 hens (${metrics.requiredNestingBoxes}).`,
      fix: `Add ${metrics.requiredNestingBoxes - metrics.nestingBoxes} more box(es).`,
    });
  }

  // ---- VENTILATION ----------------------------------------------------
  if (metrics.actualVentSqft < metrics.requiredVentSqft) {
    w.push({
      id: 'ventilation',
      severity: 'warning',
      category: 'ventilation',
      title: 'Not enough ventilation',
      detail: `~${fmt(metrics.actualVentSqft)} sq ft of vent; aim for ${fmt(
        metrics.requiredVentSqft,
      )} sq ft (moisture + ammonia control). Vents go high, above the birds.`,
      fix: 'Add ridge/eave vent length. All vents must be covered in 1/2" hardware cloth.',
    });
  }

  // ---- PREDATOR-PROOFING ---------------------------------------------
  if (WEAK_WIRE_TYPES.includes(options.wireType) || WEAK_WIRE_TYPES.includes(options.runWireType)) {
    w.push({
      id: 'weak-wire',
      severity: 'error',
      category: 'predator',
      title: 'Weak wire selected',
      detail:
        'Chicken wire (and 1" welded wire) keeps chickens IN but does not keep predators OUT. Raccoons reach through, weasels/rats pass 1" mesh, and dogs/foxes tear it.',
      fix: 'Use 1/2 in. hardware cloth anywhere security matters.',
    });
  }
  if (!options.coveredRun) {
    w.push({
      id: 'uncovered-run',
      severity: 'error',
      category: 'predator',
      title: 'Run is not covered',
      detail:
        'An open-top run lets hawks/owls strike and lets raccoons and fishers climb in. NH has all of these.',
      fix: 'Keep the solid corrugated roof (or at minimum hardware-cloth the top).',
    });
  }
  if (options.antiDig === 'none') {
    w.push({
      id: 'no-antidig',
      severity: 'error',
      category: 'predator',
      title: 'No anti-dig protection',
      detail:
        'Foxes and coyotes dig under un-protected walls. You need either a buried hardware-cloth skirt or an outward-facing ground apron.',
      fix: 'Add a 2 ft outward apron (easier — no digging) or bury the wire 12 in.',
    });
  }
  // Secure latch present on EVERY door? Check each door independently — a single
  // .some() would miss the case where only the run door's latch is removed.
  const coopLatchOk = materials.some((m) => m.id === 'door.latch-coop' && m.status !== 'excluded');
  const runLatchOk = !run.hasHumanDoor || materials.some((m) => m.id === 'door.latch-run' && m.status !== 'excluded');
  if (!coopLatchOk || !runLatchOk) {
    const which = !coopLatchOk && !runLatchOk ? 'coop and run doors' : !coopLatchOk ? 'coop door' : 'run door';
    w.push({
      id: 'no-latch',
      severity: 'error',
      category: 'predator',
      title: 'No secure latch',
      detail: `Simple hook/spin latches get opened by raccoon hands. The ${which} ${
        which.includes('and') ? 'have' : 'has'
      } no lockable latch.`,
      fix: 'Add a spring-loaded lockable latch to every door.',
    });
  }
  if (coop.hasAutoChickenDoor) {
    w.push({
      id: 'autodoor-security',
      severity: 'info',
      category: 'predator',
      title: 'Auto door is security-critical',
      detail:
        'The automatic chicken door is a moving hole in your defenses. Confirm it closes fully after dark, the track has no gaps, and there is a manual backup.',
      fix: 'Test the close every week; keep the coop itself predator-tight as a backstop.',
    });
  }

  // ---- STRUCTURE: roof pitch + span ----------------------------------
  if (geo.coopRoofPitchPer12 < MIN_ROOF_PITCH_RISE_PER_12) {
    w.push({
      id: 'coop-pitch',
      severity: 'error',
      category: 'structure',
      title: 'Coop roof too shallow for snow',
      detail: `Coop roof is ${metrics.coopRoofPitch}; NH snow needs ${MIN_ROOF_PITCH_RISE_PER_12}:12 minimum (${RECOMMENDED_ROOF_PITCH_RISE_PER_12}:12 preferred) so snow slides.`,
      fix: 'Raise the front wall or lower the back wall to steepen the slope.',
    });
  } else if (geo.coopRoofPitchPer12 < RECOMMENDED_ROOF_PITCH_RISE_PER_12) {
    w.push({
      id: 'coop-pitch-soft',
      severity: 'info',
      category: 'structure',
      title: 'Coop roof pitch is minimal',
      detail: `Coop roof is ${metrics.coopRoofPitch} — sheds snow but ${RECOMMENDED_ROOF_PITCH_RISE_PER_12}:12+ clears wet NH snow better.`,
    });
  }
  if (geo.runRoofPitchPer12 < MIN_ROOF_PITCH_RISE_PER_12) {
    w.push({
      id: 'run-pitch',
      // Same snow-shedding threshold as the coop → same severity. A flat panel
      // roof over a walk-in run is a real collapse hazard, not a soft nudge.
      severity: 'error',
      category: 'structure',
      title: 'Run roof too shallow for snow',
      detail: `Run roof is ${metrics.runRoofPitch}; keep it at least ${MIN_ROOF_PITCH_RISE_PER_12}:12 so a heavy snow slides off instead of collapsing panels.`,
      fix: 'Raise the coop-side (high) wall of the run.',
    });
  }
  // Rafter span / sag: run rafters span half the width (center beam) — check.
  const runHalfSpan = run.widthFt / 2;
  if (runHalfSpan > MAX_UNSUPPORTED_RAFTER_SPAN_FT['2x6']) {
    w.push({
      id: 'run-span',
      severity: 'warning',
      category: 'structure',
      title: 'Run rafter span may sag',
      detail: `Even with the center beam, each 2x6 run rafter spans ${fmt(
        runHalfSpan,
      )} ft. Over ${MAX_UNSUPPORTED_RAFTER_SPAN_FT['2x6']} ft, 2x6 can sag under snow.`,
      fix: 'Add a second beam line, tighten rafter spacing to 16", or step up to 2x8 rafters.',
    });
  }
  // Coop rafter span (no interior support) across the depth.
  if (coop.depthFt > MAX_UNSUPPORTED_RAFTER_SPAN_FT['2x6']) {
    w.push({
      id: 'coop-span',
      severity: 'warning',
      category: 'structure',
      title: 'Coop rafter span is long',
      detail: `Coop shed rafters span ${fmt(coop.depthFt)} ft. 2x6 is rated to ~${MAX_UNSUPPORTED_RAFTER_SPAN_FT['2x6']} ft under snow.`,
      fix: 'Reduce depth, tighten rafter spacing, or use 2x8 rafters.',
    });
  }

  // ---- ELECTRICAL -----------------------------------------------------
  if (options.heatedWater && !options.outdoorGfci) {
    w.push({
      id: 'gfci',
      severity: 'error',
      category: 'electrical',
      title: 'Heated water without GFCI',
      detail:
        'Any outdoor/coop power — especially a heated waterer — must be on a GFCI. Water + electricity + a wood coop is a fire/shock risk.',
      fix: 'Enable the GFCI adapter, or plug into a GFCI-protected outdoor outlet.',
    });
  }
  if (options.heatedWater || options.futureLighting) {
    w.push({
      id: 'cord-safety',
      severity: 'info',
      category: 'electrical',
      title: 'Extension-cord safety',
      detail:
        'Use one continuous outdoor-rated 12-ga cord (no daisy-chaining), keep connections off the ground and dry, and never run it where birds can peck it.',
    });
  }

  // ---- BUDGET ---------------------------------------------------------
  if (budget.overBudget) {
    w.push({
      id: 'over-budget',
      severity: 'warning',
      category: 'budget',
      title: 'Over budget',
      detail: `Estimated ${budget.total.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      })} vs a ${budget.budget.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      })} target (${Math.abs(budget.remaining).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      })} over).`,
      fix: 'Shorten the run, switch the run roof to corrugated metal, or build in phases. Never cut hardware cloth or latches to save money.',
    });
  }

  return w;
}
