import type {
  CoopProject,
  MaterialCategory,
  MaterialItem,
  ItemStatus,
  RoofMaterial,
  PriceSource,
} from '../types';
import { SEED_PRICES, SIDING_OPTIONS, HARDWARE_CLOTH_ROLL } from '../constants';
import { SCRAPED_PRODUCTS } from '../pricing/scrapedProducts';
import { pickLumber, type LumberNominal } from './lumber';
import type { Geometry } from './geometry';

/**
 * Generate the full material list from the design. This is the core BOM
 * ("bill of materials") generator. It is intentionally verbose and commented
 * because every quantity is a real construction decision.
 *
 * Flow:
 *   1. buildRawItems()  — compute quantities from geometry + options.
 *   2. resolveItems()   — apply prices, locked SKUs, overrides, owned
 *                         deductions, waste, and per-line status.
 */

// A line before pricing/overrides are applied.
interface RawItem {
  id: string;
  /** Seed price/search-term key. Omitted for dynamically-priced lumber. */
  priceKey?: keyof typeof SEED_PRICES;
  category: MaterialCategory;
  name: string;
  spec: string;
  unit: string;
  baseQty: number;
  wasteFactor: number;
  phase: number;
  ownerSupplied?: boolean;
  optional?: boolean;
  securityCritical?: boolean;
  notes?: string;
  /** Override the seed price to 0 (owner supplied). */
  freePrice?: boolean;
  /** Explicit default price/search term (used for adaptive lumber, no seed key). */
  defaultUnitPrice?: number;
  defaultSearchTerm?: string;
}

/**
 * Build a dynamically-priced lumber RawItem sized to a required length. Handles
 * splicing: a member longer than a single board becomes N spliced pieces, so the
 * purchase quantity multiplies by the piece count.
 */
function lumberItem(
  base: Omit<RawItem, 'priceKey' | 'defaultUnitPrice' | 'defaultSearchTerm' | 'baseQty'>,
  nominal: LumberNominal,
  requiredFt: number,
  memberCount: number,
): RawItem {
  const s = pickLumber(nominal, requiredFt);
  return {
    ...base,
    baseQty: memberCount * s.pieces,
    defaultUnitPrice: s.price,
    defaultSearchTerm: s.searchTerm,
  };
}

/** Map a roof material + panel length to the seed price key. */
function roofPanelKey(material: RoofMaterial, lengthFt: number): keyof typeof SEED_PRICES {
  if (material === 'corrugated-metal') return 'roof.metal-panel-10';
  if (material === 'corrugated-polycarbonate') return 'roof.poly-panel-10';
  // PVC is stocked in 8 / 10 / 12 ft.
  if (lengthFt >= 11) return 'roof.pvc-panel-12';
  if (lengthFt <= 8) return 'roof.pvc-panel-8';
  return 'roof.pvc-panel-10';
}

/** Stock corrugated panel lengths (ft). Max ~12 ft for plastic. */
const PANEL_STOCK_LENGTHS = [8, 10, 12];
const PANEL_MAX_LEN_FT = 12;

/**
 * Plan how to cover a sloped roof of `slopeLengthFt` with corrugated panels.
 * Panels run down the slope; if the slope is longer than a single stocked panel
 * (a 12 ft-wide run roof ALWAYS is), we lay multiple lapped courses. Returns the
 * per-panel length and the number of courses needed down the slope.
 */
function planRoofPanels(slopeLengthFt: number): { panelLen: number; courses: number } {
  const courses = Math.max(1, Math.ceil(slopeLengthFt / PANEL_MAX_LEN_FT));
  // Each course covers its share of the slope plus a ~0.5 ft horizontal lap.
  const perCourse = slopeLengthFt / courses + (courses > 1 ? 0.5 : 0);
  const panelLen =
    PANEL_STOCK_LENGTHS.find((s) => s >= perCourse - 1e-6) ?? PANEL_STOCK_LENGTHS[PANEL_STOCK_LENGTHS.length - 1];
  return { panelLen, courses };
}

function roofMaterialLabel(material: RoofMaterial): string {
  switch (material) {
    case 'corrugated-metal':
      return 'Corrugated metal panel';
    case 'corrugated-polycarbonate':
      return 'Corrugated polycarbonate panel';
    default:
      return 'Clear corrugated PVC panel';
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Compute all raw material lines. Quantities are derived from geometry so any
 * dimension change flows straight through to the shopping list, cut list,
 * budget, and 3D model.
 */
export function buildRawItems(project: CoopProject, geo: Geometry): RawItem[] {
  const { coop, run, options, settings } = project;
  const waste = settings.wasteFactor;
  const layout = geo.roofLayout; // 'length' or 'width' — which way the one roof slopes
  const items: RawItem[] = [];

  const push = (i: RawItem) => items.push(i);

  // ----- Foundation (phase 2) -----------------------------------------
  const coopSkidCount = 3; // front / middle / back skids run the coop width
  const skid = pickLumber('4x4pt', coop.widthFt);
  push({
    id: 'lumber.skid-4x4-12-pt',
    category: 'lumber',
    name: `${skid.label} pressure-treated skid`,
    spec: `Ground-contact PT skids carrying the floor frame (${coopSkidCount} runs${
      skid.pieces > 1 ? `, ${skid.pieces} spliced pieces each` : ''
    }).`,
    unit: 'each',
    baseQty: coopSkidCount * skid.pieces,
    wasteFactor: 0,
    phase: 2,
    securityCritical: false,
    defaultUnitPrice: skid.price,
    defaultSearchTerm: skid.searchTerm,
  });
  const coopDeckBlocks = coopSkidCount * 3; // 3 support points per skid
  const runDeckBlocks = Math.ceil(geo.runWallPerimeterFt / 6);
  push({
    id: 'misc.deck-block',
    priceKey: 'misc.deck-block',
    category: 'misc',
    name: 'Precast deck block / pier',
    spec: 'Levels skids & run frame without post holes — set on tamped gravel.',
    unit: 'each',
    baseQty: coopDeckBlocks + runDeckBlocks,
    wasteFactor: 0,
    phase: 2,
  });

  // ----- Raised coop floor frame (phase 3) ----------------------------
  // Joists span the shorter (depth) dimension, spaced along the width.
  const joistCount = Math.ceil((coop.widthFt * 12) / coop.joistSpacingIn) + 1;
  const joist = pickLumber('2x8', coop.depthFt);
  push({
    id: 'lumber.joist-2x8-8',
    category: 'lumber',
    name: `${joist.label} floor joist`,
    spec: `Joists @ ${coop.joistSpacingIn}" OC spanning the ${coop.depthFt} ft depth${
      joist.pieces > 1 ? ` (${joist.pieces} spliced pieces each, over a mid-beam)` : ''
    }.`,
    unit: 'each',
    baseQty: joistCount * joist.pieces,
    wasteFactor: waste,
    phase: 3,
    defaultUnitPrice: joist.price,
    defaultSearchTerm: joist.searchTerm,
  });
  const rim = pickLumber('2x8', coop.widthFt);
  push({
    id: 'lumber.rim-2x8-12',
    category: 'lumber',
    name: `${rim.label} rim / band joist`,
    spec: `Caps the joist ends along the coop width (front & back band)${
      rim.pieces > 1 ? `, spliced over a joist` : ''
    }.`,
    unit: 'each',
    baseQty: 2 * rim.pieces,
    wasteFactor: waste,
    phase: 3,
    defaultUnitPrice: rim.price,
    defaultSearchTerm: rim.searchTerm,
  });
  push({
    id: 'fasten.joist-hangers',
    priceKey: 'fasten.joist-hangers',
    category: 'fasteners',
    name: '2x8 galvanized joist hanger',
    spec: 'Ties joists into the rim board.',
    unit: 'each',
    baseQty: joistCount + 2,
    wasteFactor: 0,
    phase: 3,
  });
  const floorSheets = Math.ceil(geo.coopAreaSqft / 32);
  push({
    id: 'sheet.floor-ply-34',
    priceKey: 'sheet.floor-ply-34',
    category: 'sheet-goods',
    name: '3/4 in. plywood floor sheathing (4x8)',
    spec: 'Solid subfloor under your owner-supplied vinyl plank.',
    unit: 'sheet',
    baseQty: floorSheets,
    wasteFactor: waste,
    phase: 3,
  });
  push({
    id: 'fasten.construction-adhesive',
    priceKey: 'fasten.construction-adhesive',
    category: 'fasteners',
    name: 'Subfloor construction adhesive',
    spec: 'Glue + screw the subfloor to kill squeaks and stiffen the floor.',
    unit: 'tube',
    baseQty: 2,
    wasteFactor: 0,
    phase: 3,
  });

  // ----- Owner-supplied vinyl plank flooring (phase 4) ----------------
  push({
    id: 'floor.vinyl-plank',
    priceKey: 'floor.vinyl-plank',
    category: 'flooring',
    name: 'Waterproof vinyl plank flooring',
    spec: `Owner-supplied. Covers the ${Math.round(geo.coopAreaSqft)} sq ft coop floor over the subfloor.`,
    unit: 'sqft',
    baseQty: Math.ceil(geo.coopAreaSqft),
    wasteFactor: 0,
    phase: 4,
    ownerSupplied: true,
    freePrice: true,
    notes: 'Already owned — waterproof, wipes clean, protects the subfloor.',
  });

  // ----- Coop wall framing (phase 5) ----------------------------------
  // Perimeter studs @ spacing + extra for corners, openings, blocking.
  const studBase = Math.ceil((geo.coopWallPerimeterFt * 12) / coop.studSpacingIn);
  const studExtra = 12; // corners, king/jack studs at door + window, blocking
  // Studs carry only roof + snow load (not a habitable room), so they use
  // snow-load spacing and are bought to the tall (ridge) wall; the seam wall is
  // cut down to the sloping plane.
  const studStock = pickLumber('2x4', geo.coopTallWallFt);
  push({
    id: 'lumber.stud-2x4-8',
    category: 'lumber',
    name: `${studStock.label} wall stud`,
    spec: `Wall studs @ ${coop.studSpacingIn}" OC (snow-load spacing), sized to the ${geo.coopTallWallFt} ft tall (ridge) wall; the seam wall is cut down.`,
    unit: 'each',
    baseQty: studBase + studExtra,
    wasteFactor: waste,
    phase: 5,
    defaultUnitPrice: studStock.price,
    defaultSearchTerm: studStock.searchTerm,
  });
  const plateLf = geo.coopWallPerimeterFt * 2; // top + bottom plate
  // Plates run the wall length and splice over studs; buy the longest handy board.
  const plateStock = pickLumber('2x4', Math.min(16, Math.max(coop.widthFt, coop.depthFt)));
  push({
    id: 'lumber.plate-2x4-12',
    category: 'lumber',
    name: `${plateStock.label} top/bottom plate`,
    spec: 'Top and bottom wall plates around the coop (spliced over studs as needed).',
    unit: 'each',
    baseQty: Math.ceil(plateLf / plateStock.lengthFt),
    wasteFactor: waste,
    phase: 5,
    defaultUnitPrice: plateStock.price,
    defaultSearchTerm: plateStock.searchTerm,
  });

  // ----- Coop siding (phase 6) ----------------------------------------
  const siding = SIDING_OPTIONS.find((s) => s.id === coop.sidingOption) ?? SIDING_OPTIONS[0];
  const sidingSheets = Math.ceil(geo.coopWallAreaSqft / 32);
  push({
    id: siding.materialId,
    priceKey: siding.materialId as keyof typeof SEED_PRICES,
    category: 'sheet-goods',
    name: `${siding.name} (4x8 sheet)`,
    spec: `Exterior siding for ~${Math.round(geo.coopWallAreaSqft)} sq ft of wall.`,
    unit: 'sheet',
    baseQty: sidingSheets,
    wasteFactor: waste,
    phase: 6,
  });
  // Finish coat / weather barrier depends on siding choice.
  if (coop.sidingOption === 'osb-wrap') {
    push({
      id: 'sheet.house-wrap',
      priceKey: 'sheet.house-wrap',
      category: 'sheet-goods',
      name: 'House wrap (weather barrier)',
      spec: 'Required over OSB — OSB is not weatherproof on its own.',
      unit: 'sqft',
      baseQty: Math.ceil(geo.coopWallAreaSqft * 1.1),
      wasteFactor: 0,
      phase: 6,
      securityCritical: false,
    });
  } else {
    push({
      id: 'sheet.exterior-paint',
      priceKey: 'sheet.exterior-paint',
      category: 'sheet-goods',
      name: 'Exterior paint / primer',
      spec: 'Seal + protect the siding. ~1 gal per 350 sq ft, 2 coats.',
      unit: 'gallon',
      baseQty: Math.max(2, Math.ceil((geo.coopWallAreaSqft * 2) / 350)),
      wasteFactor: 0,
      phase: 6,
    });
  }
  push({
    id: 'lumber.trim-1x4-8',
    priceKey: 'lumber.trim-1x4-8',
    category: 'lumber',
    name: '1x4 x 8 ft exterior trim',
    spec: 'Corner boards + door/window trim to seal siding edges.',
    unit: 'each',
    baseQty: 8,
    wasteFactor: waste,
    phase: 6,
  });

  // ----- Coop roof framing (phase 7) ----------------------------------
  // Rafters run down the slope: spaced across the ridge direction. 'length'
  // slope → rafters spaced across the coop width; 'width' slope → spaced along
  // the coop depth. Purlins run the other way (perpendicular to the rafters).
  const coopRafterCount =
    (layout === 'length'
      ? Math.ceil((coop.widthFt * 12) / coop.rafterSpacingIn)
      : Math.ceil((coop.depthFt * 12) / coop.rafterSpacingIn)) + 1;
  const coopRafter = pickLumber('2x6', geo.coopRoofSlopeLengthFt);
  push({
    id: 'lumber.rafter-2x6-10',
    category: 'lumber',
    name: `${coopRafter.label} rafter`,
    spec: `Shed rafters @ ${coop.rafterSpacingIn}" OC over the ~${geo.coopRoofSlopeLengthFt.toFixed(1)} ft slope (incl. overhang).`,
    unit: 'each',
    baseQty: coopRafterCount * coopRafter.pieces,
    wasteFactor: waste,
    phase: 7,
    defaultUnitPrice: coopRafter.price,
    defaultSearchTerm: coopRafter.searchTerm,
  });
  const coopPurlinRows = Math.max(2, Math.ceil(geo.coopRoofSlopeLengthFt / 2));
  const coopPurlinLenFt = layout === 'length' ? coop.widthFt + 2 * coop.roofOverhangFt : coop.depthFt;
  const coopPurlin = pickLumber('2x4', coopPurlinLenFt); // adaptive so stock actually fits the span
  push({
    id: 'lumber.coop-purlin-2x4-12',
    category: 'lumber',
    name: `${coopPurlin.label} roof purlin`,
    spec: `Horizontal purlins the corrugated panels screw to (${coopPurlinRows} rows across the rafters).`,
    unit: 'each',
    baseQty: coopPurlinRows * coopPurlin.pieces,
    wasteFactor: waste,
    phase: 7,
    defaultUnitPrice: coopPurlin.price,
    defaultSearchTerm: coopPurlin.searchTerm,
  });

  // ----- Corrugated coop roof (phase 8) -------------------------------
  // Panels are laid in columns across the width, and in courses down the slope
  // (a single panel only reaches ~12 ft, so long slopes take multiple courses).
  // Panel columns run along the ridge (the coop's own span in that direction).
  const coopRidgeSpanFt =
    (layout === 'length' ? coop.widthFt : coop.depthFt) + 2 * coop.roofOverhangFt;
  const coopColumns = Math.ceil(coopRidgeSpanFt / 2);
  const coopPlan = planRoofPanels(geo.coopRoofSlopeLengthFt);
  const coopPanelCount = coopColumns * coopPlan.courses;
  push({
    id: 'roof.coop-panel',
    priceKey: roofPanelKey(coop.roofMaterial, coopPlan.panelLen),
    category: 'roofing',
    name: `${roofMaterialLabel(coop.roofMaterial)} (${coopPlan.panelLen} ft) — coop end of roof`,
    spec: `${coopPanelCount} panels: ${coopColumns} columns${
      coopPlan.courses > 1 ? ` × ${coopPlan.courses} lapped courses` : ''
    } over the coop's ${geo.coopRoofSlopeLengthFt.toFixed(1)} ft of the continuous slope.`,
    unit: 'panel',
    baseQty: coopPanelCount,
    wasteFactor: 0, // coverage already rounds up; whole panels, minimal offcut
    phase: 8,
  });

  // ----- Run roof panels — the run's share of the ONE roof (phase 14) --
  // Same plane as the coop end: columns run along the ridge (the run's own span
  // in that direction); courses lap down the run's part of the slope.
  const runRidgeSpanFt =
    (layout === 'length' ? run.widthFt : run.lengthFt) + 2 * coop.roofOverhangFt;
  const runColumns = Math.ceil(runRidgeSpanFt / 2);
  const runPlan = planRoofPanels(geo.runRoofSlopeLengthFt);
  const runPanelCount = runColumns * runPlan.courses;
  push({
    id: 'roof.run-panel',
    priceKey: roofPanelKey(run.roofMaterial, runPlan.panelLen),
    category: 'roofing',
    name: `${roofMaterialLabel(run.roofMaterial)} (${runPlan.panelLen} ft) — run end of roof`,
    spec: `${runPanelCount} panels: ${runColumns} columns${
      runPlan.courses > 1 ? ` × ${runPlan.courses} lapped courses` : ''
    } continuing the coop roof down the run's ${geo.runRoofSlopeLengthFt.toFixed(1)} ft of slope.`,
    unit: 'panel',
    baseQty: runPanelCount,
    wasteFactor: 0, // coverage already rounds up; whole panels, minimal offcut
    phase: 14,
  });
  push({
    id: 'roof.closure-strip',
    priceKey: 'roof.closure-strip',
    category: 'roofing',
    name: 'Foam closure strips',
    spec: 'Fill the corrugation gaps at eaves/ridge — blocks pests & drafts.',
    unit: 'pack',
    baseQty: Math.ceil((coopPanelCount + runPanelCount) / 6),
    wasteFactor: 0,
    phase: 8,
    securityCritical: true,
    notes: 'Closes the corrugation gaps a weasel could slip through.',
  });
  push({
    id: 'roof.panel-screws',
    priceKey: 'roof.panel-screws',
    category: 'roofing',
    name: 'Panel screws w/ neoprene washers',
    spec: 'Gasketed screws to fasten panels without leaks.',
    unit: 'box',
    baseQty: Math.max(1, Math.ceil((coopPanelCount + runPanelCount) / 12)),
    wasteFactor: 0,
    phase: 8,
  });

  // ----- Coop doors / windows / vent flap (phase 9) -------------------
  push({
    id: 'door.hinges-coop',
    priceKey: 'door.hinges-heavy',
    category: 'hinges-latches-doors',
    name: 'Heavy exterior hinge (pair) — coop door',
    spec: 'For the human-size coop door.',
    unit: 'pair',
    baseQty: 1,
    wasteFactor: 0,
    phase: 9,
    securityCritical: true,
  });
  push({
    id: 'door.latch-coop',
    priceKey: 'door.latch-predator',
    category: 'hinges-latches-doors',
    name: 'Predator-proof spring latch — coop door',
    spec: 'Lockable latch a raccoon cannot flip open.',
    unit: 'each',
    baseQty: 1,
    wasteFactor: 0,
    phase: 9,
    securityCritical: true,
  });
  push({
    id: 'door.barrel-bolt-coop',
    priceKey: 'door.barrel-bolt',
    category: 'hinges-latches-doors',
    name: 'Heavy barrel bolt — coop door',
    spec: 'Second point of security on the coop door.',
    unit: 'each',
    baseQty: 1,
    wasteFactor: 0,
    phase: 9,
    securityCritical: true,
  });
  push({
    id: 'misc.hinge-hasp',
    priceKey: 'misc.hinge-hasp',
    category: 'hinges-latches-doors',
    name: 'Safety hasp + hinge (vent flap / nest lids)',
    spec: 'For the winter vent shutter and nesting-box lids.',
    unit: 'each',
    baseQty: 3,
    wasteFactor: 0,
    phase: 9,
    securityCritical: true,
  });

  // ----- Nesting boxes (phase 10) -------------------------------------
  const boxes = options.nestingBoxCount;
  if (options.nestingBoxType === 'premade-rollaway') {
    push({
      id: 'nesting.premade-rollaway',
      priceKey: 'nesting.premade-rollaway',
      category: 'nesting',
      name: 'Premade roll-away nesting unit (2 holes)',
      spec: `${Math.ceil(boxes / 2)} units to cover ${boxes} nesting holes.`,
      unit: 'unit',
      baseQty: Math.ceil(boxes / 2),
      wasteFactor: 0,
      phase: 10,
    });
  } else {
    push({
      id: 'sheet.nesting-ply-12',
      priceKey: 'sheet.nesting-ply-12',
      category: 'nesting',
      name: '1/2 in. plywood — nesting boxes',
      spec: `Build ${boxes} outside-access boxes (${Math.ceil(boxes / 3)} sheets).`,
      unit: 'sheet',
      baseQty: Math.ceil(boxes / 3),
      wasteFactor: waste,
      phase: 10,
    });
    if (options.nestingBoxType === 'diy-rollaway') {
      push({
        id: 'misc.astroturf-liner',
        priceKey: 'misc.astroturf-liner',
        category: 'nesting',
        name: 'Nest pad / astroturf liner (roll-away)',
        spec: 'Grippy sloped liner so eggs roll gently to the collection tray.',
        unit: 'pad',
        baseQty: boxes,
        wasteFactor: 0,
        phase: 10,
      });
    }
  }

  // ----- Roosts (phase 11) --------------------------------------------
  const roostFt = Math.ceil((options.chickens * 10) / 12); // 10" per bird
  // Each roost bar spans the coop width; count how many full-width bars give the
  // needed linear feet, and buy stock sized to the bar length.
  const roostBarLenFt = Math.max(2, coop.widthFt - 0.7);
  const roostBoards = Math.max(2, Math.ceil(roostFt / roostBarLenFt));
  const roostStock = pickLumber('2x4', roostBarLenFt);
  push({
    id: 'lumber.roost-2x4-12',
    category: 'lumber',
    name: `${roostStock.label} roost (flat side up)`,
    spec: `${roostBoards} full-width bars = ~${roostFt} linear ft so large birds cover their toes in winter.`,
    unit: 'each',
    baseQty: roostBoards * roostStock.pieces,
    wasteFactor: 0,
    phase: 11,
    defaultUnitPrice: roostStock.price,
    defaultSearchTerm: roostStock.searchTerm,
  });
  push({
    id: 'misc.roost-brackets',
    priceKey: 'misc.roost-brackets',
    category: 'misc',
    name: 'Roost support brackets',
    spec: 'Removable roost supports for easy cleaning.',
    unit: 'each',
    baseQty: roostBoards * 2,
    wasteFactor: 0,
    phase: 11,
  });

  // ----- Automatic chicken door (phase 12) ----------------------------
  if (coop.hasAutoChickenDoor) {
    push({
      id: 'autodoor.unit',
      priceKey: 'autodoor.unit',
      category: 'auto-door',
      name: 'Automatic chicken door kit',
      spec: 'Timer + light sensor, aluminum door. Security-critical — verify it seals fully.',
      unit: 'each',
      baseQty: 1,
      wasteFactor: 0,
      phase: 12,
      securityCritical: true,
    });
  }

  // ----- Run modular wall framing (phase 13) --------------------------
  const runDoorFt = run.hasHumanDoor ? run.humanDoorWidthFt : 0;
  const runPanels = Math.max(
    1,
    Math.ceil((geo.runWallPerimeterFt - geo.runSharedWallFt - runDoorFt) / run.panelWidthFt),
  );
  const perPanelLf = 2 * geo.runAvgWallHeightFt + 3 * run.panelWidthFt; // 2 verticals + 3 rails
  // Framing boards must be at least as long as the tall-side vertical.
  const runFrameStock = pickLumber('2x4', geo.runHighWallFt);
  const runFrameBoards = Math.ceil((runPanels * perPanelLf) / runFrameStock.lengthFt);
  push({
    id: 'lumber.run-frame-2x4-8',
    category: 'lumber',
    name: `${runFrameStock.label} run panel framing`,
    spec: `${runPanels} modular ${run.panelWidthFt} ft wall panels that unscrew to move.`,
    unit: 'each',
    baseQty: runFrameBoards,
    wasteFactor: waste,
    phase: 13,
    defaultUnitPrice: runFrameStock.price,
    defaultSearchTerm: runFrameStock.searchTerm,
  });
  const runPosts = Math.ceil(geo.runWallPerimeterFt / 8) + 4;
  const runPostStock = pickLumber('4x4pt', geo.runHighWallFt);
  push({
    id: 'lumber.run-post-4x4-8-pt',
    category: 'lumber',
    name: `${runPostStock.label} run post / sill`,
    spec: 'Ground-contact corner posts + perimeter sill on deck blocks (no post holes).',
    unit: 'each',
    baseQty: runPosts,
    wasteFactor: 0,
    phase: 13,
    defaultUnitPrice: runPostStock.price,
    defaultSearchTerm: runPostStock.searchTerm,
  });

  // ----- Run roof framing (phase 14) ----------------------------------
  // Rafters run down the shared slope. 'length' → spaced across the run width,
  // long rafters carried on cross-beams. 'width' → spaced along the run length,
  // shorter rafters carried on a center beam (a classic lean-to).
  const runRafterCount =
    (layout === 'length'
      ? Math.ceil((run.widthFt * 12) / run.rafterSpacingIn)
      : Math.ceil((run.lengthFt * 12) / run.rafterSpacingIn)) + 1;
  const runRafter = pickLumber('2x6', geo.runRoofSlopeLengthFt);
  push({
    id: 'lumber.run-rafter-2x6-16',
    category: 'lumber',
    name: `${runRafter.label} run rafter`,
    spec: `Rafters @ ${run.rafterSpacingIn}" OC running the run's ~${geo.runRoofSlopeLengthFt.toFixed(1)} ft of the continuous slope${
      runRafter.pieces > 1 ? ` (${runRafter.pieces} spliced pieces, jointed over the beam)` : ''
    }.`,
    unit: 'each',
    baseQty: runRafterCount * runRafter.pieces,
    wasteFactor: waste,
    phase: 14,
    defaultUnitPrice: runRafter.price,
    defaultSearchTerm: runRafter.searchTerm,
  });
  // Beams carry the rafters mid-span; the geometry differs by layout.
  const beamPostStock = pickLumber('4x4pt', geo.runAvgWallHeightFt);
  const runBeamLines = layout === 'length' ? Math.max(0, Math.ceil(run.lengthFt / 8) - 1) : 0;
  if (layout === 'length' && runBeamLines > 0) {
    // Cross-beams across the width every ~8 ft so the long rafters don't sag.
    push({
      id: 'lumber.run-beam-2x8-12',
      priceKey: 'lumber.run-beam-2x8-12',
      category: 'lumber',
      name: '2x8 x 12 ft cross-beam (doubled)',
      spec: `${runBeamLines} doubled cross-beam line(s) across the width so the long rafters don't sag under snow.`,
      unit: 'each',
      baseQty: runBeamLines * Math.ceil(run.widthFt / 12) * 2,
      wasteFactor: waste,
      phase: 14,
    });
    push({
      id: 'lumber.run-beampost-4x4-8-pt',
      category: 'lumber',
      name: `${beamPostStock.label} beam post`,
      spec: 'Interior posts carrying the roof cross-beams, set on deck blocks.',
      unit: 'each',
      baseQty: runBeamLines,
      wasteFactor: 0,
      phase: 14,
      defaultUnitPrice: beamPostStock.price,
      defaultSearchTerm: beamPostStock.searchTerm,
    });
  } else if (layout === 'width') {
    // One center beam down the length carries the width-spanning rafters.
    push({
      id: 'lumber.run-beam-2x8-12',
      priceKey: 'lumber.run-beam-2x8-12',
      category: 'lumber',
      name: '2x8 x 12 ft center beam (doubled)',
      spec: "Doubled 2x8 center beam down the run so the width-spanning rafters don't sag under snow.",
      unit: 'each',
      baseQty: Math.ceil(run.lengthFt / 12) * 2,
      wasteFactor: waste,
      phase: 14,
    });
    push({
      id: 'lumber.run-beampost-4x4-8-pt',
      category: 'lumber',
      name: `${beamPostStock.label} beam post`,
      spec: 'Interior posts carrying the center beam, set on deck blocks.',
      unit: 'each',
      baseQty: Math.max(2, Math.ceil(run.lengthFt / 8)),
      wasteFactor: 0,
      phase: 14,
      defaultUnitPrice: beamPostStock.price,
      defaultSearchTerm: beamPostStock.searchTerm,
    });
  }
  const runPurlinRows = Math.max(2, Math.ceil(geo.runRoofSlopeLengthFt / 2.5));
  const runPurlinLenFt = layout === 'length' ? run.widthFt : run.lengthFt;
  const runPurlinBoards = Math.ceil((runPurlinRows * runPurlinLenFt) / 8);
  push({
    id: 'lumber.run-purlin-2x4-8',
    priceKey: 'lumber.run-frame-2x4-8',
    category: 'lumber',
    name: '2x4 x 8 ft run roof purlin',
    spec: 'Horizontal purlins the run roof panels screw to.',
    unit: 'each',
    baseQty: runPurlinBoards,
    wasteFactor: waste,
    phase: 14,
  });

  // ----- Hardware cloth (phases 15 & 16) ------------------------------
  const ventSqft = coop.ventLinearFt * 1; // ~1 ft tall vent strips
  const apronSqft = options.antiDig === 'apron' ? geo.runWallPerimeterFt * options.antiDigApronFt : 0;
  const buriedSqft = options.antiDig === 'buried' ? geo.runWallPerimeterFt * 1.5 : 0;
  const totalHcSqft = geo.runWallAreaSqft + ventSqft + apronSqft + buriedSqft;
  const hcRolls = totalHcSqft / HARDWARE_CLOTH_ROLL.areaSqft;
  push({
    id: 'wire.hardware-cloth-half',
    priceKey: 'wire.hardware-cloth-half',
    category: 'hardware-cloth',
    name: '1/2 in. hardware cloth (3 ft x 25 ft roll)',
    spec: `~${Math.round(totalHcSqft)} sq ft: run walls + vents${
      apronSqft ? ' + dig apron' : buriedSqft ? ' + buried skirt' : ''
    }. 1/2" mesh — NOT chicken wire.`,
    unit: 'roll',
    baseQty: hcRolls,
    wasteFactor: waste,
    phase: 15,
    securityCritical: true,
    notes: 'The single most important predator-proofing material. Keep the mesh 1/2 inch.',
  });
  push({
    id: 'wire.poultry-staples',
    priceKey: 'wire.poultry-staples',
    category: 'hardware-cloth',
    name: 'Poultry staples',
    spec: 'Fasten hardware cloth to framing every ~2 in.',
    unit: 'box',
    baseQty: Math.max(2, Math.ceil(hcRolls / 2)),
    wasteFactor: 0,
    phase: 15,
    securityCritical: true,
  });
  push({
    id: 'wire.fender-washers',
    priceKey: 'wire.fender-washers',
    category: 'hardware-cloth',
    name: 'Screws + fender washers (wire edges)',
    spec: 'Washer-and-screw the wire at seams & doors so nothing can pull it loose.',
    unit: 'box',
    baseQty: 2,
    wasteFactor: 0,
    phase: 15,
    securityCritical: true,
  });
  if (options.antiDig === 'apron') {
    push({
      id: 'misc.landscape-staples',
      priceKey: 'misc.landscape-staples',
      category: 'misc',
      name: 'Landscape staples (dig apron)',
      spec: 'Pin the outward apron flat to the ground so it disappears into the grass.',
      unit: 'pack',
      baseQty: Math.max(1, Math.ceil(geo.runWallPerimeterFt / 40)),
      wasteFactor: 0,
      phase: 16,
      securityCritical: true,
    });
  }

  // ----- Fasteners (all phases) ---------------------------------------
  push({
    id: 'fasten.ext-screws-3',
    priceKey: 'fasten.ext-screws-3',
    category: 'fasteners',
    name: '3 in. exterior structural screws (5 lb)',
    spec: 'Framing, plates, rafters, beam.',
    unit: 'box',
    baseQty: 2,
    wasteFactor: 0,
    phase: 3,
  });
  push({
    id: 'fasten.ext-screws-2',
    priceKey: 'fasten.ext-screws-2',
    category: 'fasteners',
    name: '2-1/2 in. exterior screws (5 lb)',
    spec: 'Siding, trim, panels, general assembly.',
    unit: 'box',
    baseQty: 2,
    wasteFactor: 0,
    phase: 6,
  });
  push({
    id: 'misc.caulk',
    priceKey: 'misc.caulk',
    category: 'misc',
    name: 'Exterior silicone caulk',
    spec: 'Seal siding seams, trim, and around the auto-door opening.',
    unit: 'tube',
    baseQty: 2,
    wasteFactor: 0,
    phase: 9,
  });

  // ----- Run human door (phase 13) ------------------------------------
  if (run.hasHumanDoor) {
    push({
      id: 'door.hinges-run',
      priceKey: 'door.hinges-heavy',
      category: 'hinges-latches-doors',
      name: 'Heavy exterior hinge (pair) — run door',
      spec: 'For the walk-in run door.',
      unit: 'pair',
      baseQty: 1,
      wasteFactor: 0,
      phase: 13,
      securityCritical: true,
    });
    push({
      id: 'door.latch-run',
      priceKey: 'door.latch-predator',
      category: 'hinges-latches-doors',
      name: 'Predator-proof spring latch — run door',
      spec: 'Self-closing, lockable run-door latch.',
      unit: 'each',
      baseQty: 1,
      wasteFactor: 0,
      phase: 13,
      securityCritical: true,
    });
    push({
      id: 'door.handle-run',
      priceKey: 'door.handle',
      category: 'hinges-latches-doors',
      name: 'Run door handle',
      spec: 'Exterior gate handle.',
      unit: 'each',
      baseQty: 1,
      wasteFactor: 0,
      phase: 13,
    });
  }

  // ----- Hanging feeder (phase 18) ------------------------------------
  push({
    id: 'misc.feeder-hardware',
    priceKey: 'misc.feeder-hardware',
    category: 'misc',
    name: options.feederMount === 'feeder-rail' ? 'Feeder rail hardware' : 'Hanging chain + screw-eye set',
    spec: 'Suspend feeders off the ground so rats can\'t reach them.',
    unit: 'set',
    baseQty: 2,
    wasteFactor: 0,
    phase: 18,
  });

  // ----- Electrical (phase 19) ----------------------------------------
  push({
    id: 'elec.outdoor-cord',
    priceKey: 'elec.outdoor-cord',
    category: 'electrical',
    name: 'Outdoor extension cord (12 ga, 50 ft)',
    spec: 'Heavy outdoor-rated cord from a GFCI outlet to the coop.',
    unit: 'each',
    baseQty: 1,
    wasteFactor: 0,
    phase: 19,
  });
  push({
    id: 'elec.cord-cover',
    priceKey: 'elec.cord-cover',
    category: 'electrical',
    name: 'Outdoor cord cover / protector',
    spec: 'Protect + route the cord safely; keep connections off the ground.',
    unit: 'each',
    baseQty: 1,
    wasteFactor: 0,
    phase: 19,
  });
  if (options.outdoorGfci) {
    push({
      id: 'elec.gfci-adapter',
      priceKey: 'elec.gfci-adapter',
      category: 'electrical',
      name: 'Portable outdoor GFCI adapter',
      spec: 'GFCI protection at the plug if the outlet is not already GFCI.',
      unit: 'each',
      baseQty: 1,
      wasteFactor: 0,
      phase: 19,
    });
    push({
      id: 'elec.weatherproof-box',
      priceKey: 'elec.weatherproof-box',
      category: 'electrical',
      name: 'Weatherproof in-use outlet cover',
      spec: 'Keeps the plugged-in connection dry inside the coop.',
      unit: 'each',
      baseQty: 1,
      wasteFactor: 0,
      phase: 19,
    });
  }
  if (options.heatedWater) {
    push({
      id: 'elec.heated-base',
      priceKey: 'elec.heated-base',
      category: 'electrical',
      name: 'Heated poultry waterer base',
      spec: 'Thermostatic base keeps water from freezing all NH winter.',
      unit: 'each',
      baseQty: 1,
      wasteFactor: 0,
      phase: 19,
    });
  }
  if (options.futureLighting) {
    push({
      id: 'elec.light-fixture',
      priceKey: 'elec.light-fixture',
      category: 'electrical',
      name: 'Plug-in LED light fixture (future)',
      spec: 'Optional now — run a switched plug-in fixture when you add lighting.',
      unit: 'each',
      baseQty: 1,
      wasteFactor: 0,
      phase: 19,
      optional: true,
    });
  }

  // ----- Bedding (final) ----------------------------------------------
  push({
    id: 'misc.pine-shavings',
    priceKey: 'misc.pine-shavings',
    category: 'misc',
    name: 'Pine shavings bedding',
    spec: 'Bedding over the vinyl plank floor.',
    unit: 'bale',
    baseQty: Math.max(2, Math.ceil(geo.coopAreaSqft / 25)),
    wasteFactor: 0,
    phase: 20,
  });

  return items;
}

// ---------------------------------------------------------------------------
// Price + status resolution
// ---------------------------------------------------------------------------

export function resolveItems(project: CoopProject, raw: RawItem[]): MaterialItem[] {
  const { materialOverrides, priceOverrides, lockedProducts, ownedMaterials } = project;

  // Sum owned quantities per matched material id.
  const ownedByMaterial: Record<string, number> = {};
  for (const o of ownedMaterials) {
    if (o.matchesMaterialId) {
      ownedByMaterial[o.matchesMaterialId] = (ownedByMaterial[o.matchesMaterialId] ?? 0) + o.quantity;
    }
  }

  return raw.map((r) => {
    const override = materialOverrides[r.id];
    const locked = lockedProducts[r.id];
    const priceOverride = priceOverrides[r.id];
    const seed = r.priceKey ? SEED_PRICES[r.priceKey] : undefined;
    // A product the scraper identified for this line (real Concord-store price +
    // a deep link to the exact item). Preferred over the older seed snapshot but
    // still yields to a locked product or a manual override.
    const scraped = SCRAPED_PRODUCTS[r.id];

    // Resolve unit price + provenance. Precedence: locked > manual override >
    // scraped snapshot > adaptive-lumber default / seed price.
    let unitPrice = r.defaultUnitPrice ?? seed?.unitPrice ?? 0;
    let priceSource: PriceSource = 'default';
    if (r.freePrice) {
      unitPrice = 0;
      priceSource = 'default';
    } else if (locked) {
      unitPrice = locked.unitPrice;
      priceSource = locked.priceSource ?? 'cached';
    } else if (priceOverride) {
      unitPrice = priceOverride.unitPrice;
      priceSource = priceOverride.source;
    } else if (scraped) {
      unitPrice = scraped.unitPrice;
      priceSource = 'cached';
    }

    // Deduct owned quantity from the base quantity.
    const owned = ownedByMaterial[r.id] ?? 0;
    let baseQty = Math.max(0, r.baseQty - owned);

    // Quantity after waste (only whole purchasable units).
    let qty =
      override?.qtyOverride != null
        ? override.qtyOverride
        : Math.ceil(baseQty * (1 + r.wasteFactor) - 1e-9);
    if (qty < 0) qty = 0;

    // Status resolution.
    let status: ItemStatus =
      override?.status ??
      (r.ownerSupplied ? 'owned' : r.optional ? 'optional' : 'need');
    // If everything needed is already owned via inventory, mark owned.
    if (!override?.status && owned > 0 && baseQty === 0 && !r.ownerSupplied) {
      status = 'owned';
    }

    const searchTerm =
      override?.searchTerm ?? locked?.name ?? r.defaultSearchTerm ?? seed?.searchTerm ?? r.name;
    // Deep-link straight to the scraped product when we found one and the user
    // hasn't locked their own — so "View on Home Depot" opens the exact item.
    const scrapedForLink = !locked && !r.freePrice ? scraped : undefined;

    const countsTowardBudget = status === 'need';
    const lineTotal = countsTowardBudget ? round(qty * unitPrice) : 0;

    const item: MaterialItem = {
      id: r.id,
      category: r.category,
      name: r.name,
      spec: r.spec,
      unit: r.unit,
      baseQty: round(baseQty),
      wasteFactor: r.wasteFactor,
      qty,
      unitPrice: round(unitPrice),
      priceSource,
      lineTotal,
      status,
      searchTerm,
      homeDepotSku: locked?.sku ?? scrapedForLink?.itemId,
      homeDepotUrl: locked?.url ?? scrapedForLink?.url,
      phase: r.phase,
      ownerSupplied: r.ownerSupplied,
      optional: r.optional,
      securityCritical: r.securityCritical,
      notes: override?.note ?? r.notes,
    };
    return item;
  });
}

export function computeMaterials(project: CoopProject, geo: Geometry): MaterialItem[] {
  return resolveItems(project, buildRawItems(project, geo));
}
