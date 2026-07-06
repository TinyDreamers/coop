import type { CoopProject } from '../types';

/**
 * The RECOMMENDED default design — a cost-conscious but predator-serious build
 * for 24 large-breed birds in Concord, NH. Every value here is editable in the
 * app; this is just the starting point the engine renders on first load.
 *
 * Design intent:
 *  - 8x12 walk-in coop on PT skids + deck blocks (no post holes, movable).
 *  - ONE continuous shed roof: high over the coop's 10 ft tall wall, sloping
 *    unbroken down the whole length to the far run wall — no separate roofs.
 *  - 12x24 attached walk-in run, fully roofed + 1/2" hardware cloth everywhere.
 *  - Wall studs at 24" OC — these walls only carry roof + snow load, not people.
 *  - Owner-supplied waterproof vinyl plank floor over a 3/4" subfloor.
 *  - DIY roll-away nesting (cleaner eggs), 6 boxes, outside access.
 *  - Extension-cord power for a heated waterer + future lighting, GFCI required.
 */
export const DEFAULT_PROJECT: CoopProject = {
  id: 'primary',
  schemaVersion: 1,
  name: 'My Chicken Coop',
  updatedAt: '2026-01-01T00:00:00.000Z', // stamped fresh on first save
  settings: {
    storeArea: 'Concord, NH',
    salesTaxRate: 0, // New Hampshire has no sales tax
    wasteFactor: 0.1, // 10% overage on consumables
    budget: 3000,
    helpers: 1, // me + one helper
    currency: 'USD',
  },
  coop: {
    widthFt: 12,
    depthFt: 8,
    frontWallHeightFt: 10, // TALL (ridge) wall — high end of the one continuous roof
    backWallHeightFt: 8.6, // DERIVED at runtime to the seam of the plane; stored value unused
    roofLayout: 'length', // the one continuous plane slopes down the whole length
    roofStyle: 'shed',
    roofMaterial: 'corrugated-pvc',
    roofOverhangFt: 1,
    studSpacingIn: 24, // snow-load spacing — the coop is not a habitable room
    joistSpacingIn: 16,
    rafterSpacingIn: 24,
    sidingOption: 't1-11',
    ventLinearFt: 12, // generous ridge/eave venting, hardware-cloth covered
    hasWinterVentFlap: true,
    humanDoorWidthFt: 3,
    humanDoorHeightFt: 6.5,
    hasAutoChickenDoor: true,
  },
  run: {
    widthFt: 12,
    lengthFt: 24,
    wallHeightFt: 5.5, // FAR (eave) wall — low end of the one continuous roof
    highWallHeightFt: 9.6, // DERIVED at runtime to the coop seam of the plane; stored value unused
    panelWidthFt: 4,
    roofMaterial: 'corrugated-pvc',
    roofOverhangFt: 1,
    rafterSpacingIn: 24,
    hasHumanDoor: true,
    humanDoorWidthFt: 3,
    humanDoorHeightFt: 6.5,
  },
  options: {
    chickens: 24,
    birdSize: 'large',
    nestingBoxCount: 6,
    nestingBoxType: 'diy-rollaway',
    outsideAccessNesting: true,
    roostStyle: 'standard',
    wireType: 'hardware-cloth-half',
    runWireType: 'hardware-cloth-half',
    antiDig: 'apron',
    antiDigApronFt: 2,
    coveredRun: true,
    feederMount: 'hanging-chain',
    heatedWater: true,
    futureLighting: true,
    outdoorGfci: true,
    foundation: 'skids-deck-blocks',
  },
  ownedMaterials: [
    {
      id: 'owned-vinyl',
      name: 'Waterproof vinyl plank flooring',
      quantity: 96, // sq ft — matches the 8x12 coop floor
      unit: 'sqft',
      matchesMaterialId: 'floor.vinyl-plank',
      estimatedValue: 0,
      note: 'Already owned. Goes over the plywood subfloor; bedding on top.',
    },
  ],
  materialOverrides: {},
  priceOverrides: {},
  lockedProducts: {},
  checklist: {},
  notes:
    'Starting point: 8x12 walk-in coop + 12x24 covered run for 24 Orpingtons. Priorities: predator-proof first, movable in sections, under $3k where possible.',
  photos: [],
  exportHistory: [],
};

/** Deep clone helper so the seed is never mutated by the store. */
export function freshDefaultProject(): CoopProject {
  return JSON.parse(JSON.stringify(DEFAULT_PROJECT)) as CoopProject;
}
