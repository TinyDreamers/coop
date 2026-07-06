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
 * FEET, Y is up. Coop: x∈[0,coopW], z∈[0,coopD], floor top y=1 (raised). Run:
 * x∈[0,runW], z∈[coopD, coopD+runL], on grade (y=0).
 *
 * The roof is ONE continuous plane; its height at any point is roofYAt(x,z), and
 * EVERY wall top and rafter is placed on that plane, so nothing can poke above
 * the roofline. `coop.roofLayout` decides which way it slopes:
 *   'length' → down the length (z): high at the coop tall wall, low at the far run.
 *   'width'  → across the width (x): high along x=0, low along x=W, full length.
 *
 * Each component is clickable and carries inspector metadata; cost/qty/SKU join
 * from the resolved material lines so the model reflects live pricing.
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
  const W = geo.roofWidthFt;
  const Ltot = cD + rL;
  const layout = geo.roofLayout;
  const angle = geo.roofAngleRad;
  const overhang = coop.roofOverhangFt;

  // The one plane: height at any (x,z). Slope axis depends on the layout.
  const roofYAt = (x: number, z: number) =>
    geo.ridgeHeightFt - geo.roofSlopePerFt * (layout === 'length' ? z : x);
  // Roof-tilt rotations: about X when the rafter's long axis is z (length slope);
  // about Z when the rafter's long axis is x (width slope).
  const rotAlongZ: [number, number, number] = [angle, 0, 0];
  const rotAlongX: [number, number, number] = [0, 0, -angle];
  const roofRot = layout === 'length' ? rotAlongZ : rotAlongX;

  // A wall stud/post whose top lands exactly on the roof plane.
  const wallMember = (
    name: string,
    group: ComponentGroup,
    structure: 'coop' | 'run',
    x: number,
    z: number,
    baseY: number,
    footprint: [number, number],
    color: string,
    matId: string,
    opts: Partial<Component3D> = {},
  ) => {
    const h = Math.max(0.3, roofYAt(x, z) - baseY);
    add(name, group, 'framing', structure, [x, baseY + h / 2, z], [footprint[0], h, footprint[1]], color, matId, opts);
  };

  // ---- Foundation -----------------------------------------------------
  for (let i = 0; i < 3; i++) {
    const z = (cD / 2) * i;
    add('PT skid', 'foundation', 'framing', 'coop', [cW / 2, 0.17, Math.min(Math.max(z, 0.3), cD - 0.3)], [cW, 0.3, 0.33], COLORS.pt, 'lumber.skid-4x4-12-pt', {
      cutInstructions: 'Level on deck blocks; shim dead flat.',
    });
    for (let j = 0; j < 3; j++) {
      const x = (cW / 2) * j;
      add('Deck block', 'foundation', 'framing', 'coop', [Math.min(Math.max(x, 0.4), cW - 0.4), 0, Math.min(Math.max(z, 0.4), cD - 0.4)], [0.5, 0.33, 0.5], '#9ca3af', 'misc.deck-block');
    }
  }

  // ---- Coop floor -----------------------------------------------------
  add('Subfloor deck', 'coop-floor', 'framing', 'coop', [cW / 2, FLOOR_TOP - 0.37, cD / 2], [cW, 0.75, cD], COLORS.floor, 'sheet.floor-ply-34', { material: '3/4" plywood subfloor' });
  add('Vinyl plank floor (owned)', 'coop-floor', 'fixtures', 'coop', [cW / 2, FLOOR_TOP + 0.03, cD / 2], [cW - 0.2, 0.05, cD - 0.2], COLORS.vinyl, 'floor.vinyl-plank', { material: 'Waterproof vinyl plank (owner-supplied)' });
  for (let i = 1; i < 6; i++) {
    add('Floor joist', 'coop-floor', 'framing', 'coop', [(cW / 6) * i, FLOOR_TOP - 0.6, cD / 2], [0.13, 0.6, cD], COLORS.lumberDark, 'lumber.joist-2x8-8');
  }

  // ---- Coop wall framing (studs) — tops on the plane ------------------
  const studStep = coop.studSpacingIn / 12;
  for (let x = 0; x <= cW + 0.001; x += studStep) {
    const px = Math.min(x, cW);
    wallMember('Coop wall stud (z=0)', 'coop-framing', 'coop', px, 0, FLOOR_TOP, [0.13, 0.3], COLORS.lumber, 'lumber.stud-2x4-8', { cutInstructions: `Top on the roof plane; ${coop.studSpacingIn}" OC snow-load spacing.` });
    wallMember('Coop seam wall stud (z=cD)', 'coop-framing', 'coop', px, cD, FLOOR_TOP, [0.13, 0.3], COLORS.lumber, 'lumber.stud-2x4-8');
  }
  for (let z = 0; z <= cD + 0.001; z += studStep) {
    const pz = Math.min(z, cD);
    for (const x of [0, cW]) {
      wallMember('Coop side wall stud', 'coop-framing', 'coop', x, pz, FLOOR_TOP, [0.3, 0.13], COLORS.lumber, 'lumber.stud-2x4-8', { cutInstructions: 'Top cut to the roof plane.' });
    }
  }

  // ---- Coop siding (average height per wall face) ---------------------
  const sidingMatId = (SIDING_OPTIONS.find((s) => s.id === coop.sidingOption) ?? SIDING_OPTIONS[0]).materialId;
  const wallAvg = (x0: number, z0: number, x1: number, z1: number) => (roofYAt(x0, z0) + roofYAt(x1, z1)) / 2 - FLOOR_TOP;
  const hZ0 = wallAvg(0, 0, cW, 0);
  add('Coop siding (z=0 wall)', 'coop-siding', 'siding', 'coop', [cW / 2, FLOOR_TOP + hZ0 / 2, -0.16], [cW, hZ0, 0.06], COLORS.siding, undefined, { material: 'Exterior siding', phase: 6, opacity: 0.96 });
  const hZc = wallAvg(0, cD, cW, cD);
  add('Coop siding (seam wall)', 'coop-siding', 'siding', 'coop', [cW / 2, FLOOR_TOP + hZc / 2, cD + 0.16], [cW, hZc, 0.06], COLORS.siding, undefined, { material: 'Exterior siding (coop/run seam)', phase: 6, opacity: 0.96 });
  for (const x of [0, cW]) {
    const h = wallAvg(x, 0, x, cD);
    add('Coop siding (side wall)', 'coop-siding', 'siding', 'coop', [x + (x === 0 ? -0.16 : 0.16), FLOOR_TOP + h / 2, cD / 2], [0.06, h, cD], COLORS.siding, sidingMatId, { material: 'Exterior siding', phase: 6, opacity: 0.96 });
  }

  // ---- Rafters + panels: coop share of the one plane ------------------
  const rafterStep = coop.rafterSpacingIn / 12;
  const coopSlopeLen = geo.coopRoofSlopeLengthFt;
  const roofPanelWFull = W + 2 * overhang;
  if (layout === 'length') {
    for (let x = 0; x <= cW + 0.001; x += rafterStep) {
      const px = Math.min(x, cW);
      add('Shed rafter (coop)', 'coop-roof', 'framing', 'coop', [px, roofYAt(px, cD / 2) + 0.25, cD / 2], [0.13, 0.46, coopSlopeLen], COLORS.lumberDark, 'lumber.rafter-2x6-10', { rotation: rotAlongZ, cutInstructions: `Bird's-mouth at ${geo.roofPitchPer12.toFixed(1)}:12; in line with the run rafters.` });
    }
    add('Corrugated roof — coop end', 'coop-roof', 'roofing', 'coop', [cW / 2, roofYAt(cW / 2, cD / 2) + 0.5, cD / 2], [cW + 2 * overhang, 0.07, coopSlopeLen], COLORS.roof, 'roof.coop-panel', { rotation: rotAlongZ, opacity: 0.55, material: 'Corrugated roof panels (one continuous roof)' });
  } else {
    for (let z = 0; z <= cD + 0.001; z += rafterStep) {
      const pz = Math.min(z, cD);
      add('Shed rafter (coop)', 'coop-roof', 'framing', 'coop', [W / 2, roofYAt(W / 2, pz) + 0.25, pz], [coopSlopeLen, 0.46, 0.13], COLORS.lumberDark, 'lumber.rafter-2x6-10', { rotation: rotAlongX, cutInstructions: `Bird's-mouth at ${geo.roofPitchPer12.toFixed(1)}:12; runs across the width.` });
    }
    add('Corrugated roof — coop end', 'coop-roof', 'roofing', 'coop', [W / 2, roofYAt(W / 2, cD / 2) + 0.5, cD / 2], [roofPanelWFull, 0.07, cD], COLORS.roof, 'roof.coop-panel', { rotation: rotAlongX, opacity: 0.55, material: 'Corrugated roof panels (one continuous roof)' });
  }

  // ---- Coop fixtures --------------------------------------------------
  const coopDoorTop = Math.min(coop.humanDoorHeightFt, roofYAt(1.8, 0) - FLOOR_TOP - 0.3);
  add('Human coop door', 'coop-fixtures', 'fixtures', 'coop', [1.8, FLOOR_TOP + coopDoorTop / 2, -0.22], [coop.humanDoorWidthFt, coopDoorTop, 0.12], COLORS.door, 'door.hinges-coop', { material: 'Human-size coop door (tall wall)', phase: 9 });
  const ventY = roofYAt(cW - 2, 0) - 1.2;
  add('Window / vent (hardware cloth)', 'coop-fixtures', 'hardware-cloth', 'coop', [cW - 2, ventY, -0.18], [3, 1, 0.06], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth vent (high wall)', phase: 9, opacity: 0.7 });
  if (coop.hasWinterVentFlap) {
    add('Winter vent flap', 'coop-fixtures', 'fixtures', 'coop', [cW - 2, ventY, -0.26], [3.1, 1.1, 0.05], COLORS.fixture, 'misc.hinge-hasp', { material: 'Hinged winter shutter', phase: 9 });
  }
  if (coop.hasAutoChickenDoor) {
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
  //  RUN — the SAME plane continues.
  // ====================================================================
  const z0 = cD;
  const z1 = Ltot;
  const postStep = run.panelWidthFt;
  for (let z = z0; z <= z1 + 0.001; z += postStep) {
    const pz = Math.min(z, z1);
    for (const x of [0, rW]) {
      wallMember('Run post / frame', 'run-framing', 'run', x, pz, 0, [0.33, 0.33], COLORS.pt, 'lumber.run-post-4x4-8-pt', { material: '4x4 PT post + 2x4 panel frame', phase: 13 });
    }
  }
  for (let x = 0; x <= rW + 0.001; x += postStep) {
    const px = Math.min(x, rW);
    wallMember('Run end frame', 'run-framing', 'run', px, z1, 0, [0.33, 0.33], COLORS.pt, 'lumber.run-frame-2x4-8', { material: 'Far end-wall framing', phase: 13 });
  }

  // ---- Roof supports: cross-beams (length) or a center beam (width) ---
  if (layout === 'length') {
    const runBeamLines = Math.max(0, Math.ceil(rL / 8) - 1);
    for (let i = 1; i <= runBeamLines; i++) {
      const z = z0 + (rL * i) / (runBeamLines + 1);
      const by = roofYAt(rW / 2, z) - 0.5;
      add('Roof cross-beam (doubled 2x8)', 'run-framing', 'framing', 'run', [rW / 2, by, z], [rW, 0.62, 0.5], COLORS.lumberDark, 'lumber.run-beam-2x8-12', { material: 'Doubled 2x8 cross-beam (carries the rafters)', phase: 14 });
      add('Beam post', 'run-framing', 'framing', 'run', [rW / 2, by / 2, z], [0.33, by, 0.33], COLORS.pt, 'lumber.run-beampost-4x4-8-pt', { material: '4x4 PT beam post', phase: 14 });
    }
  } else {
    const by = roofYAt(rW / 2, (z0 + z1) / 2) - 0.5;
    add('Center beam (doubled 2x8)', 'run-framing', 'framing', 'run', [rW / 2, by, (z0 + z1) / 2], [0.5, 0.62, rL], COLORS.lumberDark, 'lumber.run-beam-2x8-12', { material: 'Doubled 2x8 center beam (carries the rafters)', phase: 14 });
    const beamPosts = Math.max(2, Math.ceil(rL / 8));
    for (let i = 0; i < beamPosts; i++) {
      const z = z0 + (rL * (i + 0.5)) / beamPosts;
      const bp = roofYAt(rW / 2, z) - 0.5;
      add('Beam post', 'run-framing', 'framing', 'run', [rW / 2, bp / 2, z], [0.33, bp, 0.33], COLORS.pt, 'lumber.run-beampost-4x4-8-pt', { material: '4x4 PT beam post', phase: 14 });
    }
  }

  // ---- Run rafters + panels: run share of the same plane --------------
  const runRafterStep = run.rafterSpacingIn / 12;
  const runSlopeLen = geo.runRoofSlopeLengthFt;
  if (layout === 'length') {
    for (let x = 0; x <= rW + 0.001; x += runRafterStep) {
      const px = Math.min(x, rW);
      add('Run rafter (down the slope)', 'run-roof', 'framing', 'run', [px, roofYAt(px, (z0 + z1) / 2) + 0.25, (z0 + z1) / 2], [0.13, 0.46, runSlopeLen], COLORS.lumberDark, 'lumber.run-rafter-2x6-16', { rotation: rotAlongZ, material: '2x6 rafter (in line with the coop rafters)' });
    }
    add('Corrugated roof — run end', 'run-roof', 'roofing', 'run', [rW / 2, roofYAt(rW / 2, (z0 + z1) / 2) + 0.5, (z0 + z1) / 2 + overhang / 2], [rW + 2 * overhang, 0.07, runSlopeLen], COLORS.roof, 'roof.run-panel', { rotation: rotAlongZ, opacity: 0.5, material: 'Corrugated roof panels (laps onto the coop roof)' });
  } else {
    for (let z = z0; z <= z1 + 0.001; z += runRafterStep) {
      const pz = Math.min(z, z1);
      add('Run rafter (across the width)', 'run-roof', 'framing', 'run', [W / 2, roofYAt(W / 2, pz) + 0.25, pz], [runSlopeLen, 0.46, 0.13], COLORS.lumberDark, 'lumber.run-rafter-2x6-16', { rotation: rotAlongX, material: '2x6 rafter (in line with the coop rafters)' });
    }
    add('Corrugated roof — run end', 'run-roof', 'roofing', 'run', [W / 2, roofYAt(W / 2, (z0 + z1) / 2) + 0.5, (z0 + z1) / 2], [roofPanelWFull, 0.07, rL], COLORS.roof, 'roof.run-panel', { rotation: rotAlongX, opacity: 0.5, material: 'Corrugated roof panels (laps onto the coop roof)' });
  }

  // ---- Run hardware cloth (two long sides + far end + apron) ----------
  const wireH = (x: number, z: number) => Math.max(0.3, roofYAt(x, z));
  const midZ = (z0 + z1) / 2;
  add('Run wall wire (x=0 side)', 'hardware-cloth', 'hardware-cloth', 'run', [-0.05, wireH(0, midZ) / 2, midZ], [0.04, wireH(0, midZ), rL], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth', phase: 15, opacity: 0.5 });
  add('Run wall wire (x=W side)', 'hardware-cloth', 'hardware-cloth', 'run', [rW + 0.05, wireH(rW, midZ) / 2, midZ], [0.04, wireH(rW, midZ), rL], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth', phase: 15, opacity: 0.5 });
  const endH = (wireH(0, z1) + wireH(rW, z1)) / 2;
  add('Run end wire', 'hardware-cloth', 'hardware-cloth', 'run', [rW / 2, endH / 2, z1 + 0.05], [rW, endH, 0.04], COLORS.wire, 'wire.hardware-cloth-half', { material: '1/2" hardware cloth', phase: 15, opacity: 0.5 });
  if (options.antiDig === 'apron') {
    const ap = options.antiDigApronFt;
    add('Anti-dig apron (x=0 side)', 'hardware-cloth', 'hardware-cloth', 'run', [-ap / 2, 0.02, midZ], [ap, 0.03, rL], COLORS.wire, 'wire.hardware-cloth-half', { material: 'Outward hardware-cloth apron', phase: 16, opacity: 0.6 });
    add('Anti-dig apron (x=W side)', 'hardware-cloth', 'hardware-cloth', 'run', [rW + ap / 2, 0.02, midZ], [ap, 0.03, rL], COLORS.wire, 'wire.hardware-cloth-half', { material: 'Outward hardware-cloth apron', phase: 16, opacity: 0.6 });
    add('Anti-dig apron (end)', 'hardware-cloth', 'hardware-cloth', 'run', [rW / 2, 0.02, z1 + ap / 2], [rW, 0.03, ap], COLORS.wire, 'wire.hardware-cloth-half', { material: 'Outward hardware-cloth apron', phase: 16, opacity: 0.6 });
  }

  // ---- Run fixtures ---------------------------------------------------
  if (run.hasHumanDoor) {
    const doorZ = Math.min(z0 + 2, z1 - 0.5);
    const doorTop = Math.min(run.humanDoorHeightFt, roofYAt(0, doorZ) - 0.3);
    add('Human run door', 'run-fixtures', 'fixtures', 'run', [-0.08, doorTop / 2, doorZ], [0.12, doorTop, run.humanDoorWidthFt], COLORS.door, 'door.hinges-run', { material: 'Walk-in run door (tall side)', phase: 13 });
  }
  add('Hanging feeder', 'run-fixtures', 'fixtures', 'run', [rW / 2, 2.6, z0 + 3], [1, 1.4, 1], '#6b7280', 'misc.feeder-hardware', { material: 'Suspended feeder', phase: 18 });

  return comps;
}
