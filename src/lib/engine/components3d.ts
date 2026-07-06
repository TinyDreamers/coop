import type {
  Component3D,
  ComponentGroup,
  ComponentLayer,
  CoopProject,
  MaterialItem,
} from '../types';
import { SIDING_OPTIONS, COOP_FLOOR_HEIGHT_FT } from '../constants';
import type { Geometry } from './geometry';

/**
 * Build a parametric set of 3D components from the design. Coordinates are in
 * FEET, Y is up. The scene is laid out as:
 *   - Coop:  x∈[0,coopW], z∈[0,coopD]; raised floor top at y=1.
 *   - Run:   x∈[0,runW], z∈[coopD, coopD+runL]; on grade (y=0).
 *
 * ROOF: a SINGLE continuous shed plane slopes down the length (z). It is high at
 * the coop's tall gable wall (z=0) and drops, unbroken across the coop/run seam,
 * to the far run wall (z=coopD+runL). Every wall top and rafter is placed on that
 * one plane, so there is no step or valley between the coop and the run.
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

const FLOOR_TOP = COOP_FLOOR_HEIGHT_FT; // raised coop floor height above grade

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
  const rW = run.widthFt;
  const rL = run.lengthFt;
  const W = geo.roofWidthFt; // width the single roof spans
  const Ltot = cD + rL; // total length under the one roof

  // The single roof plane: high at z=0 (coop tall wall), low at z=Ltot (far run).
  const ridgeAbs = geo.ridgeHeightFt;
  const slope = geo.roofTotalRunFt > 0 ? geo.roofRiseFt / geo.roofTotalRunFt : 0;
  const roofYAt = (z: number) => ridgeAbs - slope * z;
  const roofAngle = geo.roofAngleRad; // tilt of the plane about the X axis

  const tallH = geo.coopTallWallFt;
  const seamH = geo.coopSeamWallFt;

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
  for (let i = 1; i < 6; i++) {
    const x = (cW / 6) * i;
    add('Floor joist', 'coop-floor', 'framing', 'coop', [x, FLOOR_TOP - 0.6, cD / 2], [0.13, 0.6, cD], COLORS.lumberDark, 'lumber.joist-2x8-8');
  }

  // ---- Coop wall framing (studs) --------------------------------------
  const studStep = coop.studSpacingIn / 12;
  // Tall (ridge) wall at z=0 and the shorter seam wall at z=cD run along x.
  for (let x = 0; x <= cW + 0.001; x += studStep) {
    const px = Math.min(x, cW);
    add('Tall (ridge) wall stud', 'coop-framing', 'framing', 'coop', [px, FLOOR_TOP + tallH / 2, 0], [0.13, tallH, 0.3], COLORS.lumber, 'lumber.stud-2x4-8', {
      cutInstructions: `Cut to ${(tallH * 12 - 3).toFixed(0)}″ (less plates). ${coop.studSpacingIn}" OC snow-load spacing.`,
    });
    add('Seam wall stud', 'coop-framing', 'framing', 'coop', [px, FLOOR_TOP + seamH / 2, cD], [0.13, seamH, 0.3], COLORS.lumber, 'lumber.stud-2x4-8');
  }
  // Side walls run along z; the top steps down the single slope (tall → seam).
  for (let z = 0; z <= cD + 0.001; z += studStep) {
    const pz = Math.min(z, cD);
    const h = tallH + (seamH - tallH) * (pz / cD);
    for (const x of [0, cW]) {
      add('Side wall stud (stepped)', 'coop-framing', 'framing', 'coop', [x, FLOOR_TOP + h / 2, pz], [0.3, h, 0.13], COLORS.lumber, 'lumber.stud-2x4-8', {
        cutInstructions: 'Steps shorter toward the run seam; top cut to the roof pitch.',
      });
    }
  }

  // ---- Coop siding ----------------------------------------------------
  add('Tall wall siding', 'coop-siding', 'siding', 'coop', [cW / 2, FLOOR_TOP + tallH / 2, -0.16], [cW, tallH, 0.06], COLORS.siding, undefined, { material: 'Exterior siding (tall gable wall)', phase: 6, opacity: 0.96 });
  add('Seam wall siding', 'coop-siding', 'siding', 'coop', [cW / 2, FLOOR_TOP + seamH / 2, cD + 0.16], [cW, seamH, 0.06], COLORS.siding, undefined, { material: 'Exterior siding (coop/run seam)', phase: 6, opacity: 0.96 });
  const sidingMatId = (SIDING_OPTIONS.find((s) => s.id === coop.sidingOption) ?? SIDING_OPTIONS[0]).materialId;
  for (const x of [-0.16, cW + 0.16]) {
    const avgH = (tallH + seamH) / 2;
    add('Side siding', 'coop-siding', 'siding', 'coop', [x, FLOOR_TOP + avgH / 2, cD / 2], [0.06, avgH, cD], COLORS.siding, sidingMatId, { material: 'Exterior siding', phase: 6, opacity: 0.96 });
  }

  // ---- Roof: coop end of the ONE continuous plane ---------------------
  const rafterStep = coop.rafterSpacingIn / 12;
  const coopRoofZc = cD / 2;
  const coopSlopeLen = geo.coopRoofSlopeLengthFt;
  for (let x = 0; x <= cW + 0.001; x += rafterStep) {
    const px = Math.min(x, cW);
    add('Shed rafter (coop end)', 'coop-roof', 'framing', 'coop', [px, roofYAt(coopRoofZc) + 0.25, coopRoofZc], [0.13, 0.46, coopSlopeLen], COLORS.lumberDark, 'lumber.rafter-2x6-10', {
      // +X rotation drops the +z (down-slope) end and lifts the z=0 (ridge) end.
      rotation: [roofAngle, 0, 0],
      cutInstructions: `Bird's-mouth at ${geo.roofPitchPer12.toFixed(1)}:12; in line with the run rafters.`,
    });
  }
  add('Corrugated roof — coop end', 'coop-roof', 'roofing', 'coop', [W / 2, roofYAt(coopRoofZc) + 0.5, coopRoofZc], [W + 2 * coop.roofOverhangFt, 0.07, coopSlopeLen], COLORS.roof, 'roof.coop-panel', {
    rotation: [roofAngle, 0, 0],
    opacity: 0.55,
    material: 'Corrugated roof panels (one continuous roof)',
  });

  // ---- Coop fixtures --------------------------------------------------
  add('Human coop door', 'coop-fixtures', 'fixtures', 'coop', [cW / 2, FLOOR_TOP + coop.humanDoorHeightFt / 2, -0.22], [coop.humanDoorWidthFt, coop.humanDoorHeightFt, 0.12], COLORS.door, 'door.hinges-coop', { material: 'Human-size coop door (in the tall wall)', phase: 9 });
  add('Window / vent (hardware cloth)', 'coop-fixtures', 'hardware-cloth', 'coop', [cW - 2, FLOOR_TOP + tallH - 1, -0.18], [3, 1, 0.06], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth vent (high on the tall wall)', phase: 9, opacity: 0.7 });
  if (coop.hasWinterVentFlap) {
    add('Winter vent flap', 'coop-fixtures', 'fixtures', 'coop', [cW - 2, FLOOR_TOP + tallH - 1, -0.26], [3.1, 1.1, 0.05], COLORS.fixture, 'misc.hinge-hasp', { material: 'Hinged winter shutter', phase: 9 });
  }
  if (coop.hasAutoChickenDoor) {
    // Pop door in the seam wall so birds pass from the coop into the run.
    add('Automatic chicken door', 'coop-fixtures', 'fixtures', 'coop', [cW / 2 - 3, FLOOR_TOP + 0.6, cD + 0.2], [1, 1.2, 0.12], '#4b5563', 'autodoor.unit', { material: 'Automatic pop door (coop → run)', phase: 12 });
  }
  const boxN = Math.min(options.nestingBoxCount, 8);
  for (let i = 0; i < boxN; i++) {
    const z = 1 + (i * (cD - 2)) / Math.max(1, boxN - 1);
    add('Outside-access nest box', 'coop-fixtures', 'fixtures', 'coop', [-0.7, FLOOR_TOP + 1.6, z], [1.3, 1.1, 1.1], COLORS.nesting, project.options.nestingBoxType === 'premade-rollaway' ? 'nesting.premade-rollaway' : 'sheet.nesting-ply-12', { material: 'Nesting box (exterior lid)', phase: 10 });
  }
  for (let i = 0; i < 2; i++) {
    add('Roost bar', 'coop-fixtures', 'fixtures', 'coop', [cW / 2, FLOOR_TOP + 2.5, 2 + i * 2], [cW - 1, 0.12, 0.3], COLORS.lumberDark, 'lumber.roost-2x4-12', { material: '2x4 roost (flat)', phase: 11 });
  }

  // ====================================================================
  //  RUN — x∈[0,rW], z∈[cD, Ltot]; on grade. The SAME roof plane continues.
  // ====================================================================
  const z0 = cD;
  const z1 = Ltot;

  // Perimeter posts on the two long sides; their tops meet the sloping plane.
  const postStep = run.panelWidthFt;
  for (let z = z0; z <= z1 + 0.001; z += postStep) {
    const pz = Math.min(z, z1);
    const h = roofYAt(pz);
    for (const x of [0, rW]) {
      add('Run post / frame', 'run-framing', 'framing', 'run', [x, h / 2, pz], [0.33, h, 0.33], COLORS.pt, 'lumber.run-post-4x4-8-pt', { material: '4x4 PT post + 2x4 panel frame', phase: 13 });
    }
  }
  // Far end wall (z=Ltot) — the low eave end.
  const eaveH = geo.runLowWallFt;
  for (let x = 0; x <= rW + 0.001; x += postStep) {
    const px = Math.min(x, rW);
    add('Run end frame', 'run-framing', 'framing', 'run', [px, eaveH / 2, z1], [0.33, eaveH, 0.33], COLORS.pt, 'lumber.run-frame-2x4-8', { material: 'Far (eave) end-wall framing', phase: 13 });
  }
  // Cross-beams across the width every ~8 ft, carrying the long down-slope rafters.
  const runBeamLines = Math.max(0, Math.ceil(rL / 8) - 1);
  for (let i = 1; i <= runBeamLines; i++) {
    const z = z0 + (rL * i) / (runBeamLines + 1);
    const by = roofYAt(z) - 0.5;
    add('Roof cross-beam (doubled 2x8)', 'run-framing', 'framing', 'run', [rW / 2, by, z], [rW, 0.62, 0.5], COLORS.lumberDark, 'lumber.run-beam-2x8-12', { material: 'Doubled 2x8 cross-beam (carries the rafters)', phase: 14 });
    add('Beam post', 'run-framing', 'framing', 'run', [rW / 2, by / 2, z], [0.33, by, 0.33], COLORS.pt, 'lumber.run-beampost-4x4-8-pt', { material: '4x4 PT beam post', phase: 14 });
  }

  // ---- Roof: run end of the ONE continuous plane ----------------------
  const runRafterStep = run.rafterSpacingIn / 12;
  const runRoofZc = (z0 + z1) / 2;
  const runSlopeLen = geo.runRoofSlopeLengthFt;
  for (let x = 0; x <= rW + 0.001; x += runRafterStep) {
    const px = Math.min(x, rW);
    add('Run rafter (down the slope)', 'run-roof', 'framing', 'run', [px, roofYAt(runRoofZc) + 0.25, runRoofZc], [0.13, 0.46, runSlopeLen], COLORS.lumberDark, 'lumber.run-rafter-2x6-16', {
      rotation: [roofAngle, 0, 0],
      material: '2x6 rafter (in line with the coop rafters)',
    });
  }
  add('Corrugated roof — run end', 'run-roof', 'roofing', 'run', [W / 2, roofYAt(runRoofZc) + 0.5, runRoofZc + coop.roofOverhangFt / 2], [W + 2 * coop.roofOverhangFt, 0.07, runSlopeLen], COLORS.roof, 'roof.run-panel', {
    rotation: [roofAngle, 0, 0],
    opacity: 0.5,
    material: 'Corrugated roof panels (laps onto the coop roof)',
  });

  // ---- Run hardware cloth (two long sides + far end + apron) ----------
  const avgRunH = geo.runAvgWallHeightFt;
  add('Run wall wire (x=0 side)', 'hardware-cloth', 'hardware-cloth', 'run', [-0.05, avgRunH / 2, (z0 + z1) / 2], [0.04, avgRunH, rL], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth', phase: 15, opacity: 0.5 });
  add('Run wall wire (x=W side)', 'hardware-cloth', 'hardware-cloth', 'run', [rW + 0.05, avgRunH / 2, (z0 + z1) / 2], [0.04, avgRunH, rL], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth', phase: 15, opacity: 0.5 });
  add('Run end wire', 'hardware-cloth', 'hardware-cloth', 'run', [rW / 2, eaveH / 2, z1 + 0.05], [rW, eaveH, 0.04], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth', phase: 15, opacity: 0.5 });
  if (options.antiDig === 'apron') {
    const ap = options.antiDigApronFt;
    add('Anti-dig apron (x=0 side)', 'hardware-cloth', 'hardware-cloth', 'run', [-ap / 2, 0.02, (z0 + z1) / 2], [ap, 0.03, rL], COLORS.wire, 'wire.hardware-cloth-half', { material: 'Outward hardware-cloth apron', phase: 16, opacity: 0.6 });
    add('Anti-dig apron (x=W side)', 'hardware-cloth', 'hardware-cloth', 'run', [rW + ap / 2, 0.02, (z0 + z1) / 2], [ap, 0.03, rL], COLORS.wire, 'wire.hardware-cloth-half', { material: 'Outward hardware-cloth apron', phase: 16, opacity: 0.6 });
    add('Anti-dig apron (end)', 'hardware-cloth', 'hardware-cloth', 'run', [rW / 2, 0.02, z1 + ap / 2], [rW, 0.03, ap], COLORS.wire, 'wire.hardware-cloth-half', { material: 'Outward hardware-cloth apron', phase: 16, opacity: 0.6 });
  }

  // ---- Run fixtures ---------------------------------------------------
  if (run.hasHumanDoor) {
    add('Human run door', 'run-fixtures', 'fixtures', 'run', [rW - 2, run.humanDoorHeightFt / 2, z1 + 0.08], [run.humanDoorWidthFt, run.humanDoorHeightFt, 0.12], COLORS.door, 'door.hinges-run', { material: 'Walk-in run door (far end)', phase: 13 });
  }
  add('Hanging feeder', 'run-fixtures', 'fixtures', 'run', [rW / 2, 2.6, z0 + 3], [1, 1.4, 1], '#6b7280', 'misc.feeder-hardware', { material: 'Suspended feeder', phase: 18 });

  return comps;
}
