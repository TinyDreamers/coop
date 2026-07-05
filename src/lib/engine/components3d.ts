import type {
  Component3D,
  ComponentGroup,
  ComponentLayer,
  CoopProject,
  MaterialItem,
} from '../types';
import { SIDING_OPTIONS } from '../constants';
import type { Geometry } from './geometry';

/**
 * Build a parametric set of 3D components from the design. Coordinates are in
 * FEET, Y is up. The scene is laid out as:
 *   - Coop:  x∈[0,coopW], z∈[0,coopD]; raised floor top at y=1.
 *            Short back wall at z=0, tall front wall at z=coopD (shed slope over z).
 *   - Run:   x∈[0,runW], z∈[coopD, coopD+runL]; on grade (y=0).
 *            Roof slopes over the width (x): high at x=0, low at x=runW.
 *
 * Each component is clickable in the viewer and carries inspector metadata.
 * Cost/quantity/SKU are joined from the resolved material lines so the model
 * always reflects live pricing.
 */

const COLORS = {
  pt: '#7f9a6f',
  lumber: '#caa26a',
  lumberDark: '#a97d47',
  floor: '#8a6d4b',
  vinyl: '#b8996f',
  siding: '#d8c39a',
  roof: '#9db9cc',
  wire: '#64748b',
  door: '#5f412c',
  fixture: '#8f6539',
  nesting: '#b07a43',
};

const FLOOR_TOP = 1; // raised coop floor height above grade

export function computeComponents(
  project: CoopProject,
  geo: Geometry,
  materials: MaterialItem[],
): Component3D[] {
  const { coop, run, options } = project;
  const matById = new Map(materials.map((m) => [m.id, m]));
  const comps: Component3D[] = [];

  const supplyOf = (m?: MaterialItem): Component3D['supply'] =>
    m?.ownerSupplied ? 'owner-supplied' : m?.optional ? 'optional' : 'purchased';

  let seq = 0;
  const add = (
    name: string,
    group: ComponentGroup,
    layer: ComponentLayer,
    structure: 'coop' | 'run',
    position: [number, number, number],
    size: [number, number, number],
    color: string,
    materialId: string | undefined,
    opts: Partial<Component3D> = {},
  ) => {
    const m = materialId ? matById.get(materialId) : undefined;
    comps.push({
      id: `${group}-${name.replace(/\s+/g, '-').toLowerCase()}-${seq++}`,
      name,
      group,
      layer,
      structure,
      position,
      size,
      color,
      opacity: opts.opacity,
      rotation: opts.rotation,
      material: m?.name ?? opts.material ?? name,
      dimensions: opts.dimensions ?? `${size[0].toFixed(1)}′ × ${size[1].toFixed(1)}′ × ${size[2].toFixed(1)}′`,
      quantity: m?.qty ?? opts.quantity ?? 1,
      estimatedCost: m?.lineTotal ?? opts.estimatedCost ?? 0,
      cutInstructions: opts.cutInstructions ?? m?.spec,
      phase: m?.phase ?? opts.phase ?? 1,
      supply: supplyOf(m),
      materialId,
      homeDepotSku: m?.homeDepotSku,
    });
  };

  const cW = coop.widthFt;
  const cD = coop.depthFt;
  const backTop = FLOOR_TOP + coop.backWallHeightFt;
  const frontTop = FLOOR_TOP + coop.frontWallHeightFt;
  const coopSlope = Math.atan2(coop.frontWallHeightFt - coop.backWallHeightFt, cD);

  // ---- Foundation -----------------------------------------------------
  for (let i = 0; i < 3; i++) {
    const z = (cD / 2) * i; // 0, cD/2, cD
    add('PT skid', 'foundation', 'framing', 'coop', [cW / 2, 0.17, Math.min(Math.max(z, 0.3), cD - 0.3)], [cW, 0.3, 0.33], COLORS.pt, 'lumber.skid-4x4-12-pt', {
      cutInstructions: 'Level on deck blocks; shim dead flat.',
    });
    for (let j = 0; j < 3; j++) {
      const x = (cW / 2) * j;
      add('Deck block', 'foundation', 'framing', 'coop', [Math.min(Math.max(x, 0.4), cW - 0.4), 0, Math.min(Math.max(z, 0.4), cD - 0.4)], [0.5, 0.33, 0.5], '#9ca3af', 'misc.deck-block');
    }
  }

  // ---- Coop floor -----------------------------------------------------
  add('Subfloor deck', 'coop-floor', 'framing', 'coop', [cW / 2, FLOOR_TOP - 0.37, cD / 2], [cW, 0.75, cD], COLORS.floor, 'sheet.floor-ply-34', {
    material: '3/4" plywood subfloor',
  });
  add('Vinyl plank floor (owned)', 'coop-floor', 'fixtures', 'coop', [cW / 2, FLOOR_TOP + 0.03, cD / 2], [cW - 0.2, 0.05, cD - 0.2], COLORS.vinyl, 'floor.vinyl-plank', {
    material: 'Waterproof vinyl plank (owner-supplied)',
  });
  // A few joists for context.
  for (let i = 1; i < 6; i++) {
    const x = (cW / 6) * i;
    add('Floor joist', 'coop-floor', 'framing', 'coop', [x, FLOOR_TOP - 0.6, cD / 2], [0.13, 0.6, cD], COLORS.lumberDark, 'lumber.joist-2x8-8');
  }

  // ---- Coop wall framing (studs) --------------------------------------
  const studStep = coop.studSpacingIn / 12;
  // Front (tall) & back (short) walls run along x.
  for (let x = 0; x <= cW + 0.001; x += studStep) {
    const px = Math.min(x, cW);
    add('Front wall stud', 'coop-framing', 'framing', 'coop', [px, FLOOR_TOP + coop.frontWallHeightFt / 2, cD], [0.13, coop.frontWallHeightFt, 0.3], COLORS.lumber, 'lumber.stud-2x4-8', {
      cutInstructions: `Cut to ${(coop.frontWallHeightFt * 12 - 3).toFixed(0)}″ (less plates).`,
    });
    add('Back wall stud', 'coop-framing', 'framing', 'coop', [px, FLOOR_TOP + coop.backWallHeightFt / 2, 0], [0.13, coop.backWallHeightFt, 0.3], COLORS.lumber, 'lumber.stud-2x4-8');
  }
  // Side walls run along z; height interpolates with the slope.
  for (let z = 0; z <= cD + 0.001; z += studStep) {
    const pz = Math.min(z, cD);
    const h = coop.backWallHeightFt + (coop.frontWallHeightFt - coop.backWallHeightFt) * (pz / cD);
    for (const x of [0, cW]) {
      add('Side wall stud (stepped)', 'coop-framing', 'framing', 'coop', [x, FLOOR_TOP + h / 2, pz], [0.3, h, 0.13], COLORS.lumber, 'lumber.stud-2x4-8', {
        cutInstructions: 'Steps shorter toward the back; top cut to pitch.',
      });
    }
  }

  // ---- Coop siding ----------------------------------------------------
  add('Front siding', 'coop-siding', 'siding', 'coop', [cW / 2, FLOOR_TOP + coop.frontWallHeightFt / 2, cD + 0.16], [cW, coop.frontWallHeightFt, 0.06], COLORS.siding, undefined, { material: 'Exterior siding', phase: 6, opacity: 0.96 });
  add('Back siding', 'coop-siding', 'siding', 'coop', [cW / 2, FLOOR_TOP + coop.backWallHeightFt / 2, -0.16], [cW, coop.backWallHeightFt, 0.06], COLORS.siding, undefined, { material: 'Exterior siding', phase: 6, opacity: 0.96 });
  // Join to whichever siding option is actually selected (not always T1-11).
  const sidingMatId = (SIDING_OPTIONS.find((s) => s.id === coop.sidingOption) ?? SIDING_OPTIONS[0]).materialId;
  for (const x of [-0.16, cW + 0.16]) {
    const avgH = (coop.frontWallHeightFt + coop.backWallHeightFt) / 2;
    add('Side siding', 'coop-siding', 'siding', 'coop', [x, FLOOR_TOP + avgH / 2, cD / 2], [0.06, avgH, cD], COLORS.siding, sidingMatId, { material: 'Exterior siding', phase: 6, opacity: 0.96 });
  }

  // ---- Coop roof ------------------------------------------------------
  const coopSlopeLen = geo.coopRoofSlopeLengthFt;
  const rafterStep = coop.rafterSpacingIn / 12;
  const roofMidY = (backTop + frontTop) / 2 + 0.1;
  for (let x = 0; x <= cW + 0.001; x += rafterStep) {
    const px = Math.min(x, cW);
    add('Shed rafter', 'coop-roof', 'framing', 'coop', [px, roofMidY, cD / 2], [0.13, 0.46, coopSlopeLen], COLORS.lumberDark, 'lumber.rafter-2x6-10', {
      // Negative X-rotation so the tall front (+Z) end rises and the short back drops.
      rotation: [-coopSlope, 0, 0],
      cutInstructions: `Bird's-mouth at ${geo.coopRoofPitchPer12.toFixed(1)}:12.`,
    });
  }
  add('Corrugated roof panels', 'coop-roof', 'roofing', 'coop', [cW / 2, roofMidY + 0.35, cD / 2], [cW + 2 * coop.roofOverhangFt, 0.07, coopSlopeLen + coop.roofOverhangFt], COLORS.roof, 'roof.coop-panel', {
    rotation: [-coopSlope, 0, 0],
    opacity: 0.55,
    material: 'Corrugated roof panels',
  });

  // ---- Coop fixtures --------------------------------------------------
  add('Human coop door', 'coop-fixtures', 'fixtures', 'coop', [cW / 2, FLOOR_TOP + coop.humanDoorHeightFt / 2, -0.22], [coop.humanDoorWidthFt, coop.humanDoorHeightFt, 0.12], COLORS.door, 'door.hinges-coop', { material: 'Human-size coop door', phase: 9 });
  add('Window / vent (hardware cloth)', 'coop-fixtures', 'hardware-cloth', 'coop', [cW - 2, frontTop - 1, cD + 0.18], [3, 1, 0.06], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth vent', phase: 9, opacity: 0.7 });
  if (coop.hasWinterVentFlap) {
    add('Winter vent flap', 'coop-fixtures', 'fixtures', 'coop', [cW - 2, frontTop - 1, cD + 0.26], [3.1, 1.1, 0.05], COLORS.fixture, 'misc.hinge-hasp', { material: 'Hinged winter shutter', phase: 9 });
  }
  if (coop.hasAutoChickenDoor) {
    add('Automatic chicken door', 'coop-fixtures', 'fixtures', 'coop', [cW / 2 - 3, FLOOR_TOP + 0.6, cD + 0.2], [1, 1.2, 0.12], '#4b5563', 'autodoor.unit', { material: 'Automatic pop door', phase: 12 });
  }
  // External nesting boxes on the x=0 side.
  const boxN = Math.min(options.nestingBoxCount, 8);
  for (let i = 0; i < boxN; i++) {
    const z = 1 + (i * (cD - 2)) / Math.max(1, boxN - 1);
    add('Outside-access nest box', 'coop-fixtures', 'fixtures', 'coop', [-0.7, FLOOR_TOP + 1.6, z], [1.3, 1.1, 1.1], COLORS.nesting, project.options.nestingBoxType === 'premade-rollaway' ? 'nesting.premade-rollaway' : 'sheet.nesting-ply-12', { material: 'Nesting box (exterior lid)', phase: 10 });
  }
  // Roosts.
  for (let i = 0; i < 2; i++) {
    add('Roost bar', 'coop-fixtures', 'fixtures', 'coop', [cW / 2, FLOOR_TOP + 2.5, 2 + i * 2], [cW - 1, 0.12, 0.3], COLORS.lumberDark, 'lumber.roost-2x4-12', { material: '2x4 roost (flat)', phase: 11 });
  }

  // ====================================================================
  //  RUN — x∈[0,runW], z∈[cD, cD+runL]; roof slopes over width (x).
  // ====================================================================
  const rW = run.widthFt;
  const rL = run.lengthFt;
  const z0 = cD;
  const z1 = cD + rL;
  const highX = 0; // high wall
  const runSlope = Math.atan2(run.highWallHeightFt - run.wallHeightFt, rW);
  const heightAtX = (x: number) =>
    run.highWallHeightFt + (run.wallHeightFt - run.highWallHeightFt) * (x / rW);

  // Run posts around the perimeter (skip the shared wall at z0).
  const postStep = run.panelWidthFt;
  for (let z = z0; z <= z1 + 0.001; z += postStep) {
    const pz = Math.min(z, z1);
    for (const x of [0, rW]) {
      const h = heightAtX(x);
      add('Run post / frame', 'run-framing', 'framing', 'run', [x, h / 2, pz], [0.33, h, 0.33], COLORS.pt, 'lumber.run-post-4x4-8-pt', { material: '4x4 PT post + 2x4 panel frame', phase: 13 });
    }
  }
  for (let x = 0; x <= rW + 0.001; x += postStep) {
    const px = Math.min(x, rW);
    const h = heightAtX(px);
    add('Run end frame', 'run-framing', 'framing', 'run', [px, h / 2, z1], [0.33, h, 0.33], COLORS.pt, 'lumber.run-frame-2x4-8', { material: 'Run end-wall framing', phase: 13 });
  }
  // Center beam along z at x=rW/2.
  const beamY = heightAtX(rW / 2) - 0.3;
  add('Center beam (doubled 2x8)', 'run-framing', 'framing', 'run', [rW / 2, beamY, (z0 + z1) / 2], [0.5, 0.62, rL], COLORS.lumberDark, 'lumber.run-beam-2x8-12', { material: 'Doubled 2x8 beam', phase: 14 });
  for (let i = 0; i < Math.max(2, Math.ceil(rL / 8)); i++) {
    const z = z0 + (rL * (i + 0.5)) / Math.max(2, Math.ceil(rL / 8));
    add('Beam post', 'run-framing', 'framing', 'run', [rW / 2, beamY / 2, z], [0.33, beamY, 0.33], COLORS.pt, 'lumber.run-beampost-4x4-8-pt', { material: '4x4 PT beam post', phase: 14 });
  }

  // ---- Run roof -------------------------------------------------------
  const runSlopeLen = geo.runRoofSlopeLengthFt;
  const runRoofMidY = (run.highWallHeightFt + run.wallHeightFt) / 2 + 0.15;
  const runRafterStep = run.rafterSpacingIn / 12;
  for (let z = z0; z <= z1 + 0.001; z += runRafterStep) {
    const pz = Math.min(z, z1);
    add('Run rafter', 'run-roof', 'framing', 'run', [rW / 2, runRoofMidY, pz], [runSlopeLen, 0.46, 0.13], COLORS.lumberDark, 'lumber.run-rafter-2x6-16', {
      // Negative Z-rotation so the high (x=0) side rises and the low side drops.
      rotation: [0, 0, -runSlope],
      material: '2x6 rafter (over beam)',
    });
  }
  add('Run corrugated roof', 'run-roof', 'roofing', 'run', [rW / 2, runRoofMidY + 0.35, (z0 + z1) / 2], [runSlopeLen + run.roofOverhangFt, 0.07, rL + 2 * run.roofOverhangFt], COLORS.roof, 'roof.run-panel', {
    rotation: [0, 0, -runSlope],
    opacity: 0.5,
    material: 'Corrugated roof panels',
  });

  // ---- Run hardware cloth (walls + apron) -----------------------------
  const avgRunH = (run.highWallHeightFt + run.wallHeightFt) / 2;
  add('Run wall wire (high side)', 'hardware-cloth', 'hardware-cloth', 'run', [-0.05, run.highWallHeightFt / 2, (z0 + z1) / 2], [0.04, run.highWallHeightFt, rL], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth', phase: 15, opacity: 0.5 });
  add('Run wall wire (low side)', 'hardware-cloth', 'hardware-cloth', 'run', [rW + 0.05, run.wallHeightFt / 2, (z0 + z1) / 2], [0.04, run.wallHeightFt, rL], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth', phase: 15, opacity: 0.5 });
  add('Run end wire', 'hardware-cloth', 'hardware-cloth', 'run', [rW / 2, avgRunH / 2, z1 + 0.05], [rW, avgRunH, 0.04], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth', phase: 15, opacity: 0.5 });
  if (options.antiDig === 'apron') {
    const ap = options.antiDigApronFt;
    add('Anti-dig apron (low side)', 'hardware-cloth', 'hardware-cloth', 'run', [rW + ap / 2, 0.02, (z0 + z1) / 2], [ap, 0.03, rL], COLORS.wire, 'wire.hardware-cloth-half', { material: 'Outward hardware-cloth apron', phase: 16, opacity: 0.6 });
    add('Anti-dig apron (end)', 'hardware-cloth', 'hardware-cloth', 'run', [rW / 2, 0.02, z1 + ap / 2], [rW, 0.03, ap], COLORS.wire, 'wire.hardware-cloth-half', { material: 'Outward hardware-cloth apron', phase: 16, opacity: 0.6 });
    add('Anti-dig apron (high side)', 'hardware-cloth', 'hardware-cloth', 'run', [-ap / 2, 0.02, (z0 + z1) / 2], [ap, 0.03, rL], COLORS.wire, 'wire.hardware-cloth-half', { material: 'Outward hardware-cloth apron', phase: 16, opacity: 0.6 });
  }

  // ---- Run fixtures ---------------------------------------------------
  if (run.hasHumanDoor) {
    add('Human run door', 'run-fixtures', 'fixtures', 'run', [rW - 2, run.humanDoorHeightFt / 2, z1 + 0.08], [run.humanDoorWidthFt, run.humanDoorHeightFt, 0.12], COLORS.door, 'door.hinges-run', { material: 'Walk-in run door', phase: 13 });
  }
  add('Hanging feeder', 'run-fixtures', 'fixtures', 'run', [rW / 2, 2.6, z0 + 3], [1, 1.4, 1], '#6b7280', 'misc.feeder-hardware', { material: 'Suspended feeder', phase: 18 });

  return comps;
}
