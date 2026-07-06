import type { NestingBoxOption, SidingOption, WireType } from './types';

/**
 * ===========================================================================
 * DESIGN RULES & REFERENCE DATA
 *
 * Every "magic number" the engine uses lives here so the recommendation can be
 * tuned in one place. Values reflect common backyard-poultry guidance for LARGE
 * breeds (Orpingtons) and Home-Depot-friendly standard material sizes.
 * ===========================================================================
 */

// --- Space requirements (large standard breeds) ---------------------------
export const SQFT_PER_BIRD_COOP = 4; // interior floor sq ft per large bird
export const SQFT_PER_BIRD_RUN = 10; // run sq ft per bird (min); 8 is tight
export const ROOST_IN_PER_BIRD = 10; // linear inches of roost per large bird
export const BIRDS_PER_NESTING_BOX = 4; // 1 box per 3-4 hens
export const VENT_SQFT_PER_BIRD = 1 / 6; // ~1 sq ft vent per 6 birds (year-round)

// --- Structural / snow rules (New Hampshire) ------------------------------
export const MIN_ROOF_PITCH_RISE_PER_12 = 3; // 3:12 minimum to shed NH snow
export const RECOMMENDED_ROOF_PITCH_RISE_PER_12 = 4;
export const MAX_UNSUPPORTED_RAFTER_SPAN_FT = {
  '2x4': 6,
  '2x6': 9,
  '2x8': 12,
} as const;

// --- Predator-proofing rules ----------------------------------------------
export const SECURE_WIRE_TYPES: WireType[] = ['hardware-cloth-half', 'hardware-cloth-quarter'];
export const WEAK_WIRE_TYPES: WireType[] = ['chicken-wire', 'welded-wire-1in'];
export const MAX_SAFE_GAP_IN = 0.5;

// --- Waste / framing spacing defaults -------------------------------------
export const DEFAULT_WASTE = 0.1; // 10% overage on consumables
// The coop is NOT a habitable room — its walls only carry the roof + snow load
// down to the sill, so studs are spaced for that load, not human-grade 16" OC.
export const STUD_SPACING_IN = 24;
export const JOIST_SPACING_IN = 16;
export const RAFTER_SPACING_IN = 24;

// Raised coop floor height above grade (ft). The run sits on grade; the coop
// floor is lifted this much, so the single roof plane meets the coop's walls a
// foot higher than the run's for the same absolute roof height.
export const COOP_FLOOR_HEIGHT_FT = 1;

// A single monopitch roof running the full coop+run LENGTH can only reach the
// 3:12 snow ideal with a very tall coop, so below the snow minimum it is a
// graduated warning (use metal + tighter purlins) rather than a hard error —
// until it is nearly flat, which genuinely ponds/collapses.
export const MIN_USABLE_ROOF_PITCH_RISE_PER_12 = 1.5;

// --- Standard Home Depot material dimensions ------------------------------
export const SHEET_WIDTH_FT = 4;
export const SHEET_HEIGHT_FT = 8;
export const SHEET_AREA_SQFT = SHEET_WIDTH_FT * SHEET_HEIGHT_FT; // 32

/** Corrugated roofing panel coverage after side-lap (Suntuf/Tuftex 26" panels). */
export const ROOF_PANEL_COVER_WIDTH_FT = 2; // ~24" effective from a 26" panel
export const ROOF_PANEL_LENGTHS_FT = [8, 10, 12]; // common stocked lengths

/** Hardware cloth rolls sold at Home Depot (1/2 inch, 19 gauge). */
export interface WireRoll {
  id: string;
  label: string;
  heightFt: number;
  lengthFt: number;
  areaSqft: number;
  price: number;
}
export const HARDWARE_CLOTH_ROLL: WireRoll = {
  id: 'hc-half-3x25',
  label: '1/2 in. Hardware Cloth 3 ft x 25 ft (19 ga)',
  heightFt: 3,
  lengthFt: 25,
  areaSqft: 75,
  price: 75.97, // Everbilt 308225EB — refreshed 2026-07-06 from Concord HD (#3485)
};
export const HARDWARE_CLOTH_ROLL_LARGE: WireRoll = {
  id: 'hc-half-4x50',
  label: '1/2 in. Hardware Cloth 4 ft x 50 ft (19 ga)',
  heightFt: 4,
  lengthFt: 50,
  areaSqft: 200,
  price: 169.0,
};

// --- Standard lumber lengths (ft) for cut optimization --------------------
export const LUMBER_LENGTHS_FT = [8, 10, 12, 16];

// ===========================================================================
// SEED / DEFAULT PRICES  (Concord, NH area — Home Depot, cached snapshot)
//
// Prices are realistic ~2024/2025 snapshots and are shown as "default" until
// the user fetches live pricing, enters a manual price, or locks a SKU.
// NH has no sales tax, so tax is 0 by default.
// ===========================================================================
export interface SeedPrice {
  unitPrice: number;
  unit: string;
  searchTerm: string;
}

export const SEED_PRICES: Record<string, SeedPrice> = {
  // Lumber -----------------------------------------------------------------
  'lumber.skid-4x4-12-pt': { unitPrice: 22.98, unit: 'each', searchTerm: '4x4x12 pressure treated' },
  'lumber.joist-2x8-8': { unitPrice: 11.47, unit: 'each', searchTerm: '2x8x8 lumber' },
  'lumber.rim-2x8-12': { unitPrice: 18.98, unit: 'each', searchTerm: '2x8x12 lumber' },
  'lumber.stud-2x4-8': { unitPrice: 3.98, unit: 'each', searchTerm: '2x4x8 stud' },
  'lumber.plate-2x4-12': { unitPrice: 7.28, unit: 'each', searchTerm: '2x4x12 lumber' },
  'lumber.rafter-2x6-10': { unitPrice: 13.97, unit: 'each', searchTerm: '2x6x10 lumber' },
  'lumber.run-post-4x4-8-pt': { unitPrice: 12.98, unit: 'each', searchTerm: '4x4x8 pressure treated' },
  'lumber.run-frame-2x4-8': { unitPrice: 3.98, unit: 'each', searchTerm: '2x4x8 stud' },
  'lumber.run-rafter-2x6-12': { unitPrice: 16.98, unit: 'each', searchTerm: '2x6x12 lumber' },
  // Run rafters span the full ~13 ft run-roof slope in one piece (carried
  // mid-span by the center beam), so they need 16 ft stock — a 12 ft board is
  // too short for a 12 ft-wide run roof.
  'lumber.run-rafter-2x6-16': { unitPrice: 27.98, unit: 'each', searchTerm: '2x6x16 lumber' },
  'lumber.run-beam-2x8-12': { unitPrice: 18.98, unit: 'each', searchTerm: '2x8x12 lumber' },
  'lumber.roost-2x4-8': { unitPrice: 3.98, unit: 'each', searchTerm: '2x4x8 lumber' },
  // Roost bars span the coop width, so they come from 12 ft stock (an 8 ft
  // board can't yield a full-width roost for a wide coop).
  'lumber.roost-2x4-12': { unitPrice: 7.28, unit: 'each', searchTerm: '2x4x12 lumber' },
  'lumber.trim-1x4-8': { unitPrice: 6.98, unit: 'each', searchTerm: '1x4x8 furring' },

  // Sheet goods / siding ---------------------------------------------------
  'sheet.floor-ply-34': { unitPrice: 52.98, unit: 'sheet', searchTerm: '3/4 plywood 4x8' },
  'siding.t1-11': { unitPrice: 45.98, unit: 'sheet', searchTerm: 'T1-11 siding 4x8' },
  'siding.plywood-paint': { unitPrice: 42.98, unit: 'sheet', searchTerm: '1/2 exterior plywood 4x8' },
  'siding.osb-wrap': { unitPrice: 18.98, unit: 'sheet', searchTerm: '7/16 OSB 4x8' },
  'siding.lp-smartside': { unitPrice: 49.98, unit: 'sheet', searchTerm: 'LP SmartSide panel 4x8' },
  'sheet.exterior-paint': { unitPrice: 38.98, unit: 'gallon', searchTerm: 'exterior paint gallon' },
  'sheet.house-wrap': { unitPrice: 0.28, unit: 'sqft', searchTerm: 'house wrap roll' },
  'sheet.nesting-ply-12': { unitPrice: 34.98, unit: 'sheet', searchTerm: '1/2 plywood 4x8' },

  // Roofing ----------------------------------------------------------------
  'roof.pvc-panel-8': { unitPrice: 27.98, unit: 'panel', searchTerm: 'clear corrugated PVC roof panel 8 ft' },
  'roof.pvc-panel-10': { unitPrice: 34.98, unit: 'panel', searchTerm: 'clear corrugated PVC roof panel 10 ft' },
  'roof.pvc-panel-12': { unitPrice: 42.98, unit: 'panel', searchTerm: 'clear corrugated PVC roof panel 12 ft' },
  'roof.poly-panel-10': { unitPrice: 44.98, unit: 'panel', searchTerm: 'polycarbonate corrugated panel 10 ft' },
  'roof.metal-panel-10': { unitPrice: 24.98, unit: 'panel', searchTerm: 'corrugated metal roof panel 10 ft' },
  'roof.closure-strip': { unitPrice: 8.98, unit: 'pack', searchTerm: 'corrugated foam closure strip' },
  'roof.panel-screws': { unitPrice: 16.98, unit: 'box', searchTerm: 'corrugated roof panel screws neoprene washer' },

  // Hardware cloth / wire --------------------------------------------------
  'wire.hardware-cloth-half': { unitPrice: HARDWARE_CLOTH_ROLL.price, unit: 'roll', searchTerm: '1/2 inch hardware cloth 3ft x 25ft' },
  'wire.poultry-staples': { unitPrice: 9.98, unit: 'box', searchTerm: 'poultry netting staples' },
  'wire.fender-washers': { unitPrice: 12.98, unit: 'box', searchTerm: 'fender washers screws hardware cloth' },

  // Fasteners --------------------------------------------------------------
  'fasten.ext-screws-3': { unitPrice: 29.98, unit: 'box', searchTerm: '3 inch exterior wood screws 5lb' },
  'fasten.ext-screws-2': { unitPrice: 26.98, unit: 'box', searchTerm: '2-1/2 inch exterior wood screws 5lb' },
  'fasten.framing-nails': { unitPrice: 8.98, unit: 'box', searchTerm: '16d framing nails' },
  'fasten.construction-adhesive': { unitPrice: 5.48, unit: 'tube', searchTerm: 'construction adhesive subfloor' },
  'fasten.joist-hangers': { unitPrice: 1.28, unit: 'each', searchTerm: '2x8 joist hanger galvanized' },

  // Hinges / latches / doors ----------------------------------------------
  'door.hinges-heavy': { unitPrice: 8.98, unit: 'pair', searchTerm: 'heavy duty exterior gate hinge' },
  'door.latch-predator': { unitPrice: 12.98, unit: 'each', searchTerm: 'spring loaded gate latch lockable' },
  'door.barrel-bolt': { unitPrice: 7.98, unit: 'each', searchTerm: 'heavy duty barrel bolt latch' },
  'door.handle': { unitPrice: 9.98, unit: 'each', searchTerm: 'gate handle exterior' },

  // Automatic chicken door -------------------------------------------------
  'autodoor.unit': { unitPrice: 179.0, unit: 'each', searchTerm: 'automatic chicken coop door kit timer light sensor' },

  // Electrical -------------------------------------------------------------
  'elec.outdoor-cord': { unitPrice: 34.98, unit: 'each', searchTerm: 'outdoor extension cord 12 gauge 50ft' },
  'elec.cord-cover': { unitPrice: 19.98, unit: 'each', searchTerm: 'outdoor cord protector cover' },
  'elec.gfci-adapter': { unitPrice: 24.98, unit: 'each', searchTerm: 'portable GFCI outlet adapter outdoor' },
  'elec.heated-base': { unitPrice: 49.98, unit: 'each', searchTerm: 'heated poultry waterer base' },
  'elec.weatherproof-box': { unitPrice: 14.98, unit: 'each', searchTerm: 'weatherproof outlet box in-use cover' },
  'elec.light-fixture': { unitPrice: 16.98, unit: 'each', searchTerm: 'LED shop light plug in' },

  // Nesting boxes ----------------------------------------------------------
  'nesting.premade-rollaway': { unitPrice: 189.0, unit: 'unit', searchTerm: 'roll away nesting box metal' },

  // Flooring (owner supplied) ---------------------------------------------
  'floor.vinyl-plank': { unitPrice: 0, unit: 'sqft', searchTerm: 'waterproof vinyl plank flooring (OWNED)' },

  // Misc -------------------------------------------------------------------
  'misc.deck-block': { unitPrice: 6.48, unit: 'each', searchTerm: 'deck block pier' },
  'misc.landscape-staples': { unitPrice: 12.98, unit: 'pack', searchTerm: 'landscape staples galvanized' },
  'misc.caulk': { unitPrice: 6.98, unit: 'tube', searchTerm: 'exterior silicone caulk' },
  'misc.hinge-hasp': { unitPrice: 8.98, unit: 'each', searchTerm: 'safety hasp galvanized' },
  'misc.pine-shavings': { unitPrice: 7.98, unit: 'bale', searchTerm: 'pine shavings bedding' },
  'misc.roost-brackets': { unitPrice: 4.98, unit: 'each', searchTerm: 'shelf bracket heavy duty' },
  'misc.feeder-hardware': { unitPrice: 14.98, unit: 'set', searchTerm: 'hanging chain S-hook screw eye set' },
  'misc.astroturf-liner': { unitPrice: 9.98, unit: 'pad', searchTerm: 'nest box pad washable liner' },
};

// ===========================================================================
// SIDING COMPARISON CATALOG
// ===========================================================================
export const SIDING_OPTIONS: SidingOption[] = [
  {
    id: 't1-11',
    name: 'T1-11 Plywood Siding',
    sheetPrice: SEED_PRICES['siding.t1-11'].unitPrice,
    materialId: 'siding.t1-11',
    durabilityYears: '20-30 yrs (painted)',
    pros: [
      'Structural + siding in one step (adds shear strength)',
      'Fast to hang — full 4x8 sheets',
      'Groove pattern looks finished; paint or stain',
    ],
    cons: ['Heavier sheets', 'Must seal/paint edges to prevent delamination'],
    recommended: true,
    extraNote: 'Prime + 2 coats exterior paint recommended.',
  },
  {
    id: 'plywood-paint',
    name: 'Exterior Plywood + Paint',
    sheetPrice: SEED_PRICES['siding.plywood-paint'].unitPrice,
    materialId: 'siding.plywood-paint',
    durabilityYears: '15-25 yrs (painted)',
    pros: ['Slightly cheaper per sheet than T1-11', 'Smooth paintable surface'],
    cons: ['Needs careful edge sealing', 'Less decorative than T1-11'],
    recommended: false,
    extraNote: 'Requires primer + 2 coats exterior paint.',
  },
  {
    id: 'osb-wrap',
    name: 'OSB + House Wrap (budget)',
    sheetPrice: SEED_PRICES['siding.osb-wrap'].unitPrice,
    materialId: 'siding.osb-wrap',
    durabilityYears: '10-15 yrs',
    pros: ['Cheapest sheet option', 'Fine if you add a real siding later'],
    cons: [
      'OSB swells if it ever gets wet — must stay covered by wrap + trim',
      'Not a finished exterior on its own',
    ],
    recommended: false,
    extraNote: 'Add house wrap + battens; plan to overclad eventually.',
  },
  {
    id: 'lp-smartside',
    name: 'LP SmartSide Engineered Siding',
    sheetPrice: SEED_PRICES['siding.lp-smartside'].unitPrice,
    materialId: 'siding.lp-smartside',
    durabilityYears: '30-40 yrs',
    pros: ['Most durable / rot + pest resistant', 'Comes primed', 'Long warranty'],
    cons: ['Highest cost', 'Still needs top-coat paint'],
    recommended: false,
    extraNote: 'Best longevity; costs more up front.',
  },
];

// ===========================================================================
// NESTING BOX COMPARISON CATALOG
// ===========================================================================
export const NESTING_BOX_OPTIONS: NestingBoxOption[] = [
  {
    id: 'standard',
    name: 'Standard Nesting Boxes (DIY)',
    costPerBox: 20,
    eggCleanliness: 'standard',
    effort: 'low',
    pros: ['Cheapest', 'Simple plywood build', 'Easy to clean'],
    cons: ['Hens may sit in them (dirtier eggs)', 'Occasional egg eating/breakage'],
    recommended: false,
  },
  {
    id: 'diy-rollaway',
    name: 'DIY Roll-Away Boxes',
    costPerBox: 32,
    eggCleanliness: 'high',
    effort: 'high',
    pros: [
      'Eggs roll to a collection tray — cleaner + safer',
      'Stops egg eating and breakage',
      'Cheap materials if you build them',
    ],
    cons: ['More build time', 'Needs correct floor angle + astroturf/liner'],
    recommended: true,
  },
  {
    id: 'premade-rollaway',
    name: 'Premade Roll-Away Units',
    costPerBox: SEED_PRICES['nesting.premade-rollaway'].unitPrice / 2, // ~2 holes per unit
    eggCleanliness: 'highest',
    effort: 'low',
    pros: ['Best egg cleanliness', 'No build time', 'Metal — easy to sanitize'],
    cons: ['Most expensive', 'Fixed sizes may not fit your framing'],
    recommended: false,
  },
];

// --- Tool checklist (owner already has most tools) ------------------------
export const TOOL_CHECKLIST: { tool: string; owned: boolean; note?: string }[] = [
  { tool: 'Cordless drill / impact driver', owned: true },
  { tool: 'Circular saw', owned: true },
  { tool: 'Miter saw (nice for repeat cuts)', owned: true },
  { tool: 'Speed square + tape measure', owned: true },
  { tool: '4 ft level + torpedo level', owned: true },
  { tool: 'Chalk line', owned: true },
  { tool: 'Tin snips / aviation snips (hardware cloth)', owned: true },
  { tool: 'Heavy work gloves (hardware cloth is sharp)', owned: true },
  { tool: 'Staple gun (poultry staples) or hammer', owned: true },
  { tool: 'Hearing + eye protection', owned: true },
  { tool: 'Post-hole digger', owned: false, note: 'Not needed — design avoids post holes.' },
  { tool: 'Panel/roof cutting blade for PVC', owned: false, note: 'Buy a fine-tooth blade for corrugated panels.' },
];
