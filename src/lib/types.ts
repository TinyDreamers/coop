/**
 * ===========================================================================
 * Core data model for the Coop Planner.
 *
 * There is exactly ONE project (a single chicken coop build). The `CoopProject`
 * object below is the entire persisted document — it is stored as JSON in Vercel
 * Blob (the "database") and mirrored to localStorage for offline/fallback use.
 *
 * Everything downstream (materials, cut list, budget, warnings, 3D model) is
 * DERIVED from this document by the pure functions in `lib/engine`. The document
 * only stores user INPUT + user OVERRIDES, never derived values, so the design
 * is always the single source of truth.
 * ===========================================================================
 */

// ---------------------------------------------------------------------------
// Design inputs (editable by the user)
// ---------------------------------------------------------------------------

/** Where the build happens + global assumptions used for pricing/waste. */
export interface ProjectSettings {
  storeArea: string; // e.g. "Concord, NH"
  salesTaxRate: number; // 0 for NH
  wasteFactor: number; // fraction, e.g. 0.10 for 10% overage on consumables
  budget: number; // target budget in USD, e.g. 3000
  helpers: number; // number of helpers besides the owner (1 = "me + one helper")
  currency: string; // "USD"
}

export type RoofStyle = 'shed'; // single-slope shed roof (only supported style today)

export type RoofMaterial = 'corrugated-pvc' | 'corrugated-polycarbonate' | 'corrugated-metal';

/** The walk-in coop enclosure. Dimensions in feet, heights in feet. */
export interface CoopDesign {
  widthFt: number; // along the front wall (default 12)
  depthFt: number; // front-to-back, the roof slope run (default 8)
  frontWallHeightFt: number; // tall (eave) side, default 8
  backWallHeightFt: number; // short side, default 6
  roofStyle: RoofStyle;
  roofMaterial: RoofMaterial;
  roofOverhangFt: number; // eave/rake overhang, default 1
  studSpacingIn: number; // 16 or 24
  joistSpacingIn: number; // 16
  rafterSpacingIn: number; // 16 or 24
  sidingOption: SidingOptionId;
  ventLinearFt: number; // total open vent length (covered in hardware cloth)
  hasWinterVentFlap: boolean; // closable shutter over the vent
  humanDoorWidthFt: number;
  humanDoorHeightFt: number;
  hasAutoChickenDoor: boolean;
}

/** The attached, fully predator-proofed walk-in run. */
export interface RunDesign {
  widthFt: number; // default 12 (shared wall side matches coop)
  lengthFt: number; // default 24
  wallHeightFt: number; // low side, default 6.5
  highWallHeightFt: number; // high (coop-attached) side, default 9
  panelWidthFt: number; // modular panel module, default 4
  roofMaterial: RoofMaterial;
  roofOverhangFt: number;
  rafterSpacingIn: number;
  hasHumanDoor: boolean;
  humanDoorWidthFt: number;
  humanDoorHeightFt: number;
}

export type NestingBoxType = 'standard' | 'diy-rollaway' | 'premade-rollaway';

export type WireType = 'hardware-cloth-half' | 'hardware-cloth-quarter' | 'chicken-wire' | 'welded-wire-1in';

export type AntiDigType = 'apron' | 'buried' | 'none';

export type FeederMount = 'hanging-chain' | 'feeder-rail' | 'ground';

/** All the non-dimensional design decisions. */
export interface DesignOptions {
  chickens: number; // 24
  birdSize: 'bantam' | 'standard' | 'large'; // large for Orpingtons
  nestingBoxCount: number; // 6
  nestingBoxType: NestingBoxType;
  outsideAccessNesting: boolean;
  roostStyle: 'standard' | 'ladder';
  wireType: WireType; // security wire choice
  runWireType: WireType;
  antiDig: AntiDigType;
  antiDigApronFt: number; // width of outward apron, default 2
  coveredRun: boolean;
  feederMount: FeederMount;
  // Electrical (extension-cord based, not hardwired)
  heatedWater: boolean;
  futureLighting: boolean;
  outdoorGfci: boolean;
  // Foundation
  foundation: 'skids-deck-blocks' | 'skids-only' | 'deck-blocks-only';
}

// ---------------------------------------------------------------------------
// Materials & pricing
// ---------------------------------------------------------------------------

export type MaterialCategory =
  | 'lumber'
  | 'sheet-goods'
  | 'roofing'
  | 'hardware-cloth'
  | 'fasteners'
  | 'hinges-latches-doors'
  | 'auto-door'
  | 'electrical'
  | 'nesting'
  | 'flooring'
  | 'misc';

export const MATERIAL_CATEGORIES: { id: MaterialCategory; label: string }[] = [
  { id: 'lumber', label: 'Lumber' },
  { id: 'sheet-goods', label: 'Sheet Goods / Siding' },
  { id: 'roofing', label: 'Roofing' },
  { id: 'hardware-cloth', label: 'Hardware Cloth / Wire' },
  { id: 'fasteners', label: 'Fasteners' },
  { id: 'hinges-latches-doors', label: 'Hinges / Latches / Doors' },
  { id: 'auto-door', label: 'Automatic Chicken Door' },
  { id: 'electrical', label: 'Electrical / Extension Cord / Heated Water' },
  { id: 'nesting', label: 'Nesting Boxes' },
  { id: 'flooring', label: 'Flooring / Owner-Supplied' },
  { id: 'misc', label: 'Miscellaneous' },
];

/** How the user has classified a material line. */
export type ItemStatus = 'need' | 'owned' | 'optional' | 'excluded';

/** The provenance of a price shown in the UI. */
export type PriceSource = 'default' | 'live' | 'cached' | 'manual' | 'failed';

/**
 * A single material line item as PRODUCED BY THE ENGINE. It carries the
 * computed quantity plus a *resolved* price (after applying user overrides and
 * locked SKUs). This is a derived object — not persisted directly.
 */
export interface MaterialItem {
  id: string; // stable key, e.g. "lumber.stud-2x4-8"
  category: MaterialCategory;
  name: string; // human name, e.g. "2x4 x 8 ft SPF stud"
  spec: string; // detail, e.g. "Kiln-dried whitewood, framing grade"
  unit: string; // "each" | "sheet" | "roll" | "box" | "panel" | "ft"
  baseQty: number; // computed quantity before waste
  wasteFactor: number; // 0..1 applied to this line (0 for whole units like doors)
  qty: number; // final purchase qty = ceil(baseQty * (1 + waste))
  unitPrice: number; // resolved unit price (default/manual/locked)
  priceSource: PriceSource;
  lineTotal: number; // qty * unitPrice, 0 if owned/excluded
  status: ItemStatus;
  searchTerm: string; // editable Home Depot search string
  homeDepotSku?: string; // locked SKU if chosen
  homeDepotUrl?: string;
  phase: number; // build phase index (1-based) where it is first used
  ownerSupplied?: boolean; // e.g. vinyl plank flooring
  optional?: boolean; // e.g. future lighting parts
  securityCritical?: boolean; // predator-proofing item — never auto-downgraded
  notes?: string;
}

/** User's manual price entry / override for a material id. */
export interface PriceOverride {
  unitPrice: number;
  source: Extract<PriceSource, 'manual' | 'cached' | 'live'>;
  updatedAt: string;
  note?: string;
}

/** A locked-in Home Depot product for a material id. */
export interface LockedProduct {
  sku: string;
  name: string;
  url?: string;
  unitPrice: number;
  priceSource: PriceSource; // usually 'cached' or 'manual'
  lockedAt: string;
}

/** Per-material user customizations, keyed by MaterialItem.id. */
export interface MaterialOverride {
  status?: ItemStatus;
  searchTerm?: string;
  qtyOverride?: number; // force a specific purchase qty
  note?: string;
}

// ---------------------------------------------------------------------------
// Owned inventory
// ---------------------------------------------------------------------------

export interface OwnedMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  /** If set, this owned item satisfies a generated material line (subtracted). */
  matchesMaterialId?: string;
  estimatedValue?: number; // for budget context only
  note?: string;
}

// ---------------------------------------------------------------------------
// Build checklist
// ---------------------------------------------------------------------------

/** User progress state keyed by "phaseId:stepIndex" -> done. */
export type ChecklistState = Record<string, boolean>;

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export type PhotoCategory =
  | 'site'
  | 'flooring'
  | 'owned-materials'
  | 'inspiration'
  | 'progress'
  | 'other';

export interface PhotoMeta {
  id: string;
  category: PhotoCategory;
  url: string; // Blob URL or local object URL
  filename: string;
  caption?: string;
  uploadedAt: string;
  sizeBytes?: number;
  /** True when stored as a transient local object URL (no Blob configured). */
  localOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Export history
// ---------------------------------------------------------------------------

export interface ExportRecord {
  id: string;
  kind: 'pdf' | 'csv' | 'backup';
  label: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// The whole persisted document
// ---------------------------------------------------------------------------

export interface CoopProject {
  id: string; // "primary"
  schemaVersion: number;
  name: string;
  updatedAt: string;
  settings: ProjectSettings;
  coop: CoopDesign;
  run: RunDesign;
  options: DesignOptions;
  ownedMaterials: OwnedMaterial[];
  materialOverrides: Record<string, MaterialOverride>;
  priceOverrides: Record<string, PriceOverride>;
  lockedProducts: Record<string, LockedProduct>;
  checklist: ChecklistState;
  notes: string;
  photos: PhotoMeta[];
  exportHistory: ExportRecord[];
}

// ---------------------------------------------------------------------------
// Siding comparison catalog (static reference used by the engine + UI)
// ---------------------------------------------------------------------------

export type SidingOptionId = 't1-11' | 'plywood-paint' | 'osb-wrap' | 'lp-smartside';

export interface SidingOption {
  id: SidingOptionId;
  name: string;
  /** Cost per 4x8 sheet in USD (seed/default price). */
  sheetPrice: number;
  materialId: string; // material line id used when this option is selected
  durabilityYears: string; // e.g. "20-30 yrs"
  pros: string[];
  cons: string[];
  recommended: boolean;
  /** Extra per-sheet materials note, e.g. paint or housewrap needed. */
  extraNote?: string;
}

// ---------------------------------------------------------------------------
// Nesting box comparison catalog
// ---------------------------------------------------------------------------

export interface NestingBoxOption {
  id: NestingBoxType;
  name: string;
  /** Cost per box (materials for DIY, purchase price for premade). */
  costPerBox: number;
  eggCleanliness: 'standard' | 'high' | 'highest';
  effort: 'low' | 'medium' | 'high';
  pros: string[];
  cons: string[];
  recommended: boolean;
}

// ---------------------------------------------------------------------------
// Derived-result shapes (produced by the engine, never persisted)
// ---------------------------------------------------------------------------

export type WarningSeverity = 'error' | 'warning' | 'info';

export interface Warning {
  id: string;
  severity: WarningSeverity;
  category:
    | 'space'
    | 'predator'
    | 'structure'
    | 'budget'
    | 'ventilation'
    | 'electrical';
  title: string;
  detail: string;
  /** Optional suggested fix shown inline. */
  fix?: string;
}

export interface CutListItem {
  id: string;
  part: string; // what it becomes, e.g. "Floor joist"
  stock: string; // stock lumber, e.g. "2x8 x 8 ft"
  lengthIn: number; // cut length in inches
  quantity: number;
  phase: number;
  angleNote?: string; // e.g. "one end cut to roof pitch"
  materialId: string;
}

export interface BuildStep {
  text: string;
  safety?: string;
}

export interface BuildPhase {
  id: number;
  title: string;
  summary: string;
  tools: string[];
  materials: string[]; // human labels
  estimatedHours: number; // for owner + helpers
  steps: BuildStep[];
  commonMistakes: string[];
  safetyNotes: string[];
}

/** Metadata for a single 3D component (drives the viewer + inspector). */
export type ComponentGroup =
  | 'foundation'
  | 'coop-floor'
  | 'coop-framing'
  | 'coop-siding'
  | 'coop-roof'
  | 'coop-fixtures'
  | 'run-framing'
  | 'run-roof'
  | 'hardware-cloth'
  | 'run-fixtures';

export type ComponentLayer = 'framing' | 'siding' | 'roofing' | 'hardware-cloth' | 'fixtures';

export interface Component3D {
  id: string;
  name: string;
  group: ComponentGroup;
  layer: ComponentLayer;
  structure: 'coop' | 'run';
  /** Box geometry in feet, centered at [x,y,z]; size [w,h,d]. */
  position: [number, number, number];
  size: [number, number, number];
  /** Optional rotation in radians around each axis (for sloped rafters). */
  rotation?: [number, number, number];
  color: string;
  opacity?: number;
  // Inspector metadata:
  material: string;
  dimensions: string;
  quantity: number;
  estimatedCost: number;
  cutInstructions?: string;
  phase: number;
  supply: 'purchased' | 'owner-supplied' | 'optional';
  materialId?: string;
  homeDepotSku?: string;
}

export interface BudgetSummary {
  materialsSubtotal: number; // sum of "need" lines
  ownedValue: number; // value of owned items deducted
  optionalTotal: number; // optional add-ons (not in base subtotal)
  tax: number;
  total: number; // materialsSubtotal + tax
  budget: number;
  remaining: number; // budget - total
  overBudget: boolean;
  byCategory: { category: MaterialCategory; label: string; total: number }[];
}

/** The full computed bundle returned by the engine for a project. */
export interface ComputedProject {
  geometry: import('./engine/geometry').Geometry;
  materials: MaterialItem[];
  cutList: CutListItem[];
  budget: BudgetSummary;
  warnings: Warning[];
  phases: BuildPhase[];
  components: Component3D[];
  metrics: DesignMetrics;
}

/** Headline design metrics shown on the dashboard and used by warnings. */
export interface DesignMetrics {
  coopAreaSqft: number;
  coopAreaPerBird: number;
  runAreaSqft: number;
  runAreaPerBird: number;
  roostLinearFt: number;
  roostLinearFtPerBird: number;
  requiredRoostFt: number;
  nestingBoxes: number;
  requiredNestingBoxes: number;
  coopRoofPitch: string; // "3:12"
  runRoofPitch: string;
  ventLinearFt: number;
  requiredVentSqft: number;
  actualVentSqft: number;
}
