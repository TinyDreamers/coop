/**
 * SCRAPED HOME DEPOT PRODUCTS  —  generated output of the scraper.
 *
 * This is the *result* of running the Home Depot scraper (see `homeDepotScrape.ts`)
 * over the coop's bill of materials via the Chrome extension, against the
 * signed-in Concord, NH store (store #3485) on the date below. Each entry is the
 * product the matcher identified as the correct item for a material line, plus
 * its real current price and a deep link to the exact product page.
 *
 * The engine prefers these over the older `SEED_PRICES` snapshot (they are the
 * fresher, store-accurate numbers), but a user override or a locked product
 * still wins — see `resolveItems` in `materials.ts`.
 *
 * Only entries the matcher was CONFIDENT about live here. Ambiguous searches
 * (e.g. a predator latch, roost brackets) and items Home Depot doesn't really
 * carry (pine-shavings bedding, nest-box astroturf) were deliberately left off so
 * they keep their seed price and get flagged for a human to confirm.
 *
 * To refresh: re-run the scraper (GET /api/pricing/scrape for the manifest, drive
 * the extension over each search, POST the collected candidates back) and
 * regenerate this file from the returned `lockedProducts`/`priceOverrides`.
 */

export interface ScrapedProduct {
  /** Home Depot internet #, deep-links via /p/<slug>/<itemId>. */
  itemId: string;
  name: string;
  url: string;
  unitPrice: number;
  /** How sure the matcher was. 'medium' = correct item but worth a glance. */
  confidence: 'high' | 'medium';
}

export const SCRAPE_META = {
  store: 'Concord, NH',
  storeId: '3485',
  scrapedAt: '2026-07-06',
  source: 'homedepot.com via Chrome extension (signed-in shopper)',
} as const;

/**
 * Keyed by MaterialItem.id so it maps straight onto generated material lines.
 * Adaptive lumber (studs, joists, rafters…) is priced per stock length in
 * `lumber.ts` instead — those lines change board size with the design, so a
 * static SKU would go stale, and a text search already lands the exact board.
 */
export const SCRAPED_PRODUCTS: Record<string, ScrapedProduct> = {
  // Foundation & floor -------------------------------------------------------
  'misc.deck-block': { itemId: '100350712', name: 'Concrete Deck Block (11.5 in. x 8 in. x 11-1/2 in.)', url: 'https://www.homedepot.com/p/11-5-in-x-8-in-x-11-1-2-in-Concrete-Deck-Block-10550005/100350712', unitPrice: 8.73, confidence: 'high' },
  'fasten.joist-hangers': { itemId: '100374921', name: 'Simpson Strong-Tie LUS ZMAX Galvanized Joist Hanger for 2x8', url: 'https://www.homedepot.com/p/Simpson-Strong-Tie-LUS-ZMAX-Galvanized-Face-Mount-Joist-Hanger-for-2x8-Nominal-Lumber-LUS28Z/100374921', unitPrice: 2.83, confidence: 'high' },
  'sheet.floor-ply-34': { itemId: '303564747', name: '23/32 in. x 4 ft. x 8 ft. RTD Southern Yellow Pine Sheathing Plywood', url: 'https://www.homedepot.com/p/23-32-in-x-4-ft-x-8-ft-RTD-Southern-Yellow-Pine-Wood-Sheathing-Plywood-129323/303564747', unitPrice: 43.92, confidence: 'high' },
  'fasten.construction-adhesive': { itemId: '202203997', name: 'Liquid Nails Subfloor & Deck 28 oz. Construction Adhesive', url: 'https://www.homedepot.com/p/Liquid-Nails-Subfloor-and-Deck-28-oz-Tan-Low-VOC-Construction-Adhesive-LNP-902/202203997', unitPrice: 7.48, confidence: 'high' },

  // Siding & finish ----------------------------------------------------------
  'siding.t1-11': { itemId: '100000016', name: 'Plytanium T1-11 Plywood Siding Panel 19/32 in. 4 ft. x 8 ft.', url: 'https://www.homedepot.com/p/Plytanium-Plywood-Siding-Panel-T1-11-8-IN-OC-Nominal-19-32-in-x-4-ft-x-8-ft-Actual-0-563-in-x-48-in-x-96-in-113699/100000016', unitPrice: 46.78, confidence: 'high' },
  'sheet.exterior-paint': { itemId: '100200471', name: 'BEHR 1 Gal. White Exterior Barn & Fence Paint', url: 'https://www.homedepot.com/p/BEHR-1-Gal-White-Exterior-Barn-and-Fence-Paint-03501/100200471', unitPrice: 26.98, confidence: 'high' },
  'lumber.trim-1x4-8': { itemId: '203461000', name: '1 in. x 4 in. x 8 ft. Furring Strip Board', url: 'https://www.homedepot.com/p/1-in-x-4-in-x-8-ft-Furring-Strip-Board-687642/203461000', unitPrice: 3.38, confidence: 'high' },

  // Roofing ------------------------------------------------------------------
  'roof.coop-panel': { itemId: '100000045', name: 'Palruf 2.2 ft. x 12 ft. Corrugated PVC Roof Panel in Clear', url: 'https://www.homedepot.com/p/Palruf-2-2-ft-x-12-ft-Corrugated-PVC-Roof-Panel-in-Clear-100427/100000045', unitPrice: 22.98, confidence: 'high' },
  'roof.run-panel': { itemId: '100000045', name: 'Palruf 2.2 ft. x 12 ft. Corrugated PVC Roof Panel in Clear', url: 'https://www.homedepot.com/p/Palruf-2-2-ft-x-12-ft-Corrugated-PVC-Roof-Panel-in-Clear-100427/100000045', unitPrice: 22.98, confidence: 'high' },
  'roof.closure-strip': { itemId: '100049309', name: 'Palruf 36 in. White Foam Roof Closure Strips (5-Pack)', url: 'https://www.homedepot.com/p/Palruf-36-in-Horizontal-White-Foam-Roof-Closure-Strips-5-Pack-92521/100049309', unitPrice: 8.01, confidence: 'high' },
  'roof.panel-screws': { itemId: '100095071', name: 'Woodtite 2 in. Hex-Head Wood Screw with EPDM Washer (50-Pack)', url: 'https://www.homedepot.com/p/Woodtite-2-in-Hex-Head-Wood-Screw-with-EPDM-washer-50-Pack-92523/100095071', unitPrice: 6.98, confidence: 'high' },

  // Hardware cloth (security-critical) --------------------------------------
  'wire.hardware-cloth-half': { itemId: '205960848', name: 'Everbilt 1/2 in. Mesh 3 ft. x 25 ft. 19-Gauge Galvanized Hardware Cloth', url: 'https://www.homedepot.com/p/Everbilt-1-2-in-Mesh-x-3-ft-x-25-ft-19-Gauge-Galvanized-Steel-Hardware-Cloth-308225EB/205960848', unitPrice: 75.97, confidence: 'high' },
  'wire.poultry-staples': { itemId: '318183028', name: 'Pro-Fit 3/4 in. Galvanized Poultry Net Staple 1 lb. (413-Count)', url: 'https://www.homedepot.com/p/PRO-FIT-3-4-in-Hot-Dipped-Galvanized-Poultry-Net-Staple-1-lb-413-Count-0051038/318183028', unitPrice: 5.74, confidence: 'high' },

  // Doors / latches ----------------------------------------------------------
  'door.barrel-bolt-coop': { itemId: '327600116', name: 'Everbilt 6 in. Black Heavy-Duty Barrel Bolt', url: 'https://www.homedepot.com/p/Everbilt-6-in-Black-Heavy-Duty-Barrel-Bolt-33500/327600116', unitPrice: 11.62, confidence: 'high' },
  'door.handle-run': { itemId: '204986541', name: 'Barrette 7.875 in. Black Gate Handle', url: 'https://www.homedepot.com/p/Barrette-Outdoor-Living-7-875-in-Black-Gate-Handle-73014320/204986541', unitPrice: 7.85, confidence: 'high' },

  // Automatic chicken door (specialty; confirm before buying) ---------------
  'autodoor.unit': { itemId: '335754385', name: 'Aluminum Automatic Chicken Coop Door with Timer & Light Sensor (LCD)', url: 'https://www.homedepot.com/p/KIWDZFU-Aluminum-Automatic-Chicken-Coop-Door-with-Timer-Light-Sensor-LCD-Screen-Electric-Opener-Anti-Pinch-Protection-Equipment-SA0522162/335754385', unitPrice: 248.56, confidence: 'medium' },

  // Fasteners ----------------------------------------------------------------
  'fasten.ext-screws-3': { itemId: '100200675', name: 'Grip-Rite #9 x 3 in. Exterior Wood Screws 5 lb. Box', url: 'https://www.homedepot.com/p/Grip-Rite-9-x-3-in-2-Phillips-Bugle-Head-Coarse-Thread-Sharp-Point-Coated-Exterior-Wood-Screws-5-lb-Box-PTN3S5/100200675', unitPrice: 34.47, confidence: 'high' },
  'fasten.ext-screws-2': { itemId: '100136137', name: 'Grip-Rite #9 x 2-1/2 in. Exterior Wood Screws 5 lb. Box', url: 'https://www.homedepot.com/p/Grip-Rite-9-x-2-1-2-in-2-Phillips-Bugle-Head-Coarse-Thread-Coated-Exterior-Wood-Screws-5-lb-Box-PTN212S5/100136137', unitPrice: 34.47, confidence: 'high' },
  'misc.caulk': { itemId: '317766846', name: 'GE Supreme Silicone Caulk 10.1 oz. Window & Door Sealant, Clear', url: 'https://www.homedepot.com/p/GE-Supreme-Silicone-Caulk-10-1-oz-Window-and-Door-Sealant-Clear-2814816/317766846', unitPrice: 13.48, confidence: 'high' },
  'misc.landscape-staples': { itemId: '321160972', name: 'Agfabric 6 in. 11-Gauge Galvanized Landscape Staples (100-Pcs)', url: 'https://www.homedepot.com/p/Agfabric-6-in-11-Gauge-Galvanized-Landscape-Staples-Stake-Silver-Metal-Weedmat-Stake-Pins-for-Weed-Barrier-Sod-100-Pcs-WP340150100P/321160972', unitPrice: 14.59, confidence: 'high' },

  // Electrical ---------------------------------------------------------------
  'elec.outdoor-cord': { itemId: '205544514', name: 'Southwire 50 ft. 12/3 SJTW Hi-Vis Outdoor Heavy-Duty Extension Cord', url: 'https://www.homedepot.com/p/Southwire-50-ft-12-3-SJTW-Hi-Visibility-Outdoor-Heavy-Duty-Extension-Cord-with-Power-Light-Plug-2588SW0002/205544514', unitPrice: 64.99, confidence: 'high' },
  'elec.cord-cover': { itemId: '207139731', name: 'Twist and Seal Cord Protect Outdoor Extension Cord Cover', url: 'https://www.homedepot.com/p/Twist-and-Seal-Cord-Protect-Outdoor-Extension-Cord-Cover-and-Plug-Protection-Green-TSCP-G-1000/207139731', unitPrice: 5.97, confidence: 'high' },
  'elec.gfci-adapter': { itemId: '303814661', name: 'Husky 15 Amp Grounded GFCI Outlet Adapter, Black', url: 'https://www.homedepot.com/p/Husky-15-Amp-Grounded-GFCI-Outlet-Adapter-Black-04-00106/303814661', unitPrice: 19.98, confidence: 'high' },
  'elec.weatherproof-box': { itemId: '300849073', name: 'Commercial Electric 1-Gang Extra Duty In-Use Weatherproof Outlet Cover', url: 'https://www.homedepot.com/p/Commercial-Electric-1-Gang-Extra-Duty-Horizontal-Vertical-Non-Metallic-Weatherproof-In-Use-Outlet-Cover-16-in-1-Configurations-Clear-WCW1PC/300849073', unitPrice: 11.53, confidence: 'high' },
  'elec.heated-base': { itemId: '336558854', name: '14 in. Heated Chicken Waterer Base, 5 Gallon (Winter Poultry Fountain)', url: 'https://www.homedepot.com/p/N-A-14-in-Heated-Chicken-Waterer-Base-5-Gallon-Anti-bite-Cable-Winter-Poultry-Fountains-Plastic-Metal-Water-Bowl-BSA1122C262/336558854', unitPrice: 81.07, confidence: 'medium' },

  // Run cross-beam (fixed 2x8x12) -------------------------------------------
  'lumber.run-beam-2x8-12': { itemId: '206182009', name: '2 in. x 8 in. x 12 ft. #2 Premium Grade Fir Dimensional Lumber', url: 'https://www.homedepot.com/p/2-in-x-8-in-x-12-ft-2-Premium-Grade-Fir-Dimensional-Lumber-604372/206182009', unitPrice: 16.12, confidence: 'high' },
};
