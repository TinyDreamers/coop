import { describe, it, expect } from 'vitest';
import {
  parseSpec,
  parseFraction,
  candidateFacts,
  scoreCandidate,
  pickBest,
  homeDepotAbsoluteUrl,
  type HDCandidate,
} from './homeDepotScrape';

/**
 * These fixtures are REAL Home Depot search results captured for "2x4x8 stud"
 * (Concord, NH store) via the in-page extractor. They deliberately include the
 * traps a naive scraper falls into: a $115 LVL boxed set, a $91 cedar 4-pack, a
 * $70 hardwood board, a PT decking board, and a 4x4 post — all returned
 * alongside the actual $3.98 framing stud. The matcher must pick the stud.
 */
const STUD_RESULTS: HDCandidate[] = [
  { itemId: '312528776', name: '2 in. x 4 in. x 96 in. #2 Premium Grade KD-HT Stud', price: 3.98, uom: 'each', category: ['Lumber & Composites', 'Dimensional Lumber', 'Framing Studs'], ratingCount: 6016, index: 0 },
  { itemId: '206262176', name: '2 in. x 4 in. x 96 in. Premium Burrill Fir Stud', price: 4.48, uom: 'each', category: ['Lumber & Composites', 'Dimensional Lumber', 'Framing Studs'], ratingCount: 822, index: 1 },
  { itemId: '206565340', name: '2 in. x 4 in. x 8 ft. Versa-Stud LVL SP 2650 1.7 (3-Piece per Box)', brand: 'Boise Cascade', price: 115.56, uom: 'set', category: ['Lumber & Composites', 'Engineered Lumber', 'LVL Beams'], ratingCount: 27, index: 2 },
  { itemId: '206966018', name: '2 in. x 4 in. x 8 ft. #1 Ground Contact Pressure-Treated Southern Yellow Pine Lumber', brand: 'WeatherShield', price: 6.28, uom: 'each', category: ['Lumber & Composites', 'Decking', 'Deck Boards', 'Wood Decking Boards'], ratingCount: 373, index: 3 },
  { itemId: '205220341', name: '4 in. x 4 in. x 8 ft. #2 Ground Contact Pressure-Treated Southern Yellow Pine Wood Post', price: 11.28, uom: 'each', category: ['Lumber & Composites', 'Decking', 'Deck Posts', 'Wood Deck Posts'], ratingCount: 5827, index: 4 },
  { itemId: '333309702', name: '2 in. x 4 in. x 92-5/8 in. Prime Whitewood Stud', price: 3.92, uom: 'each', category: ['Lumber & Composites', 'Dimensional Lumber', 'Framing Studs'], ratingCount: 468, index: 5 },
  { itemId: '206936036', name: '2 in. x 4 in. x 8 ft. Rough Sawn Western Red Cedar Fence Panel Backer Rail (4-Pack)', brand: 'ProWood', price: 91.72, uom: 'each', category: ['Lumber & Composites', 'Fencing & Gates', 'Wood Fencing', 'Wood Fence Rails'], ratingCount: 73, index: 6 },
  { itemId: '314962333', name: '2 in. x 4 in. x 8 ft. Poplar S4S Board', brand: 'Swaner Hardwood', price: 70.88, uom: 'each', category: ['Lumber & Composites', 'Boards & Planks', 'Wood Boards', 'Hardwood Boards'], ratingCount: 14, index: 7 },
];

describe('parseFraction', () => {
  it('parses whole-and-fraction, plain fractions, and integers', () => {
    expect(parseFraction('92-5/8')).toBeCloseTo(92.625, 3);
    expect(parseFraction('3/4')).toBeCloseTo(0.75, 3);
    expect(parseFraction('1-1/2')).toBeCloseTo(1.5, 3);
    expect(parseFraction('96')).toBe(96);
    expect(parseFraction('nope')).toBeNull();
  });
});

describe('parseSpec', () => {
  it('parses dimensional lumber', () => {
    const s = parseSpec('2x4x8 stud', 'each');
    expect(s.nominal).toBe('2x4');
    expect(s.lengthFt).toBe(8);
    expect(s.wantsPT).toBe(false);
    expect(s.wantsPack).toBe(false);
    expect(s.keywords).toContain('stud');
  });

  it('flags pressure-treated intent and 4x4 nominal', () => {
    const s = parseSpec('4x4x8 pressure treated', 'each');
    expect(s.nominal).toBe('4x4');
    expect(s.lengthFt).toBe(8);
    expect(s.wantsPT).toBe(true);
  });

  it('parses sheet goods with thickness', () => {
    const s = parseSpec('3/4 plywood 4x8', 'sheet');
    expect(s.sheet).toBe(true);
    expect(s.thickness).toBe('3/4');
    expect(s.keywords).toContain('plywood');
  });

  it('parses roll dimensions for hardware cloth', () => {
    const s = parseSpec('1/2 inch hardware cloth 3ft x 25ft', 'roll');
    expect(s.rollDims).toEqual({ wFt: 3, lenFt: 25 });
    expect(s.keywords).toEqual(expect.arrayContaining(['hardware', 'cloth']));
  });

  it('parses gauge and standalone length for a cord', () => {
    const s = parseSpec('outdoor extension cord 12 gauge 50ft', 'each');
    expect(s.gauge).toBe(12);
    expect(s.lengthFt).toBe(50);
  });

  it('treats box/lb terms as wanting a package', () => {
    expect(parseSpec('3 inch exterior wood screws 5lb', 'box').wantsPack).toBe(true);
    expect(parseSpec('poultry netting staples', 'box').wantsPack).toBe(true);
  });
});

describe('candidateFacts', () => {
  it('reads nominal + length from a stud name (inches)', () => {
    const f = candidateFacts(STUD_RESULTS[0]);
    expect(f.nominal).toBe('2x4');
    expect(f.lengthFt).toBeCloseTo(8, 1);
    expect(f.isMultiPack).toBe(false);
    expect(f.isPT).toBe(false);
  });

  it('treats a precut stud length (92-5/8 in.) as ~8 ft', () => {
    const f = candidateFacts(STUD_RESULTS[5]);
    expect(f.lengthFt).toBeCloseTo(7.72, 1);
  });

  it('detects boxed sets and packs', () => {
    expect(candidateFacts(STUD_RESULTS[2]).isMultiPack).toBe(true); // "(3-Piece per Box)" + uom set
    expect(candidateFacts(STUD_RESULTS[6]).isMultiPack).toBe(true); // "(4-Pack)"
  });

  it('detects pressure-treated and the 4x4 nominal', () => {
    const post = candidateFacts(STUD_RESULTS[4]);
    expect(post.nominal).toBe('4x4');
    expect(post.isPT).toBe(true);
  });
});

describe('pickBest — the correct item, not just a dimensional match', () => {
  it('picks the framing stud over the LVL set, 4-pack, hardwood board, and PT board', () => {
    const spec = parseSpec('2x4x8 stud', 'each');
    const pick = pickBest(spec, { candidates: STUD_RESULTS });
    expect(pick.chosen?.itemId).toBe('312528776'); // the #2 KD-HT stud @ $3.98
    expect(pick.chosen?.price).toBe(3.98);
    expect(pick.confidence).not.toBe('low');
    expect(pick.confidence).not.toBe('none');
  });

  it('ranks all impostors below both real studs', () => {
    const spec = parseSpec('2x4x8 stud', 'each');
    const scored = STUD_RESULTS.map((c) => ({ id: c.itemId, s: scoreCandidate(spec, c) }));
    // Apply the same outlier pass pickBest does by reading final ranking:
    const pick = pickBest(spec, { candidates: STUD_RESULTS });
    const chosenIds = [pick.chosen!.itemId, ...pick.alternatives.map((a) => a.cand.itemId)];
    const studPositions = ['312528776', '333309702', '206262176'].map((id) => chosenIds.indexOf(id));
    const impostorPositions = ['206565340', '206936036', '314962333', '205220341'].map((id) => chosenIds.indexOf(id));
    // Every real stud ranks ahead of every impostor.
    expect(Math.max(...studPositions)).toBeLessThan(Math.min(...impostorPositions.filter((p) => p >= 0)));
    void scored;
  });

  it('disqualifies the 4x4 post for a 2x4 query', () => {
    const spec = parseSpec('2x4x8 stud', 'each');
    const post = scoreCandidate(spec, STUD_RESULTS[4]);
    expect(post.disqualified).toBe(true);
  });

  it('SAME candidate pool, PT 4x4 query → picks the 4x4 post, not a stud', () => {
    const spec = parseSpec('4x4x8 pressure treated', 'each');
    const pick = pickBest(spec, { candidates: STUD_RESULTS });
    expect(pick.chosen?.itemId).toBe('205220341'); // the 4x4x8 PT post @ $11.28
    expect(pick.confidence).toBe('high');
  });

  it('does not penalize a multipack when the unit expects a package', () => {
    const spec = parseSpec('cedar backer rail', 'box'); // box → wantsPack
    const packScore = scoreCandidate(spec, STUD_RESULTS[6]).score;
    const noPackSpec = parseSpec('cedar backer rail', 'each');
    const noPackScore = scoreCandidate(noPackSpec, STUD_RESULTS[6]).score;
    expect(packScore).toBeGreaterThan(noPackScore);
  });

  it('returns none-confidence for an empty result set', () => {
    const spec = parseSpec('2x4x8 stud', 'each');
    const pick = pickBest(spec, { candidates: [] });
    expect(pick.chosen).toBeNull();
    expect(pick.confidence).toBe('none');
  });
});

/**
 * Real "automatic chicken coop door" results: the correct product is a $248
 * specialty item sitting among cheap sponsored motion-sensor switches. The
 * price-outlier guard must NOT kill it, because it clearly answers the query.
 */
const CHICKEN_DOOR_RESULTS: HDCandidate[] = [
  { itemId: '203202128', name: 'Maestro Motion Sensor Switch, 2 Amp/Single-Pole, White (MS-OPS2H-WH)', price: 24.98, uom: 'each', category: ['Electrical', 'Wiring Devices & Light Controls', 'Motion Sensor Light Switches'], ratingCount: 2026, sponsored: true, index: 0 },
  { itemId: '316126703', name: 'Decora In-Wall Motion Sensor Light Switch, Motion Activated, Auto-On/Auto-Off, 2-Amp, Single Pole, White DOS02-1LW', price: 24.98, uom: 'each', category: ['Electrical', 'Wiring Devices & Light Controls', 'Motion Sensor Light Switches'], ratingCount: 352, sponsored: true, index: 1 },
  { itemId: '335754385', name: 'Aluminum Automatic Chicken Coop Door with Timer Light Sensor LCD Screen Electric Opener Anti-Pinch Protection Equipment', price: 248.56, uom: 'each', category: ['Lumber & Composites', 'Fencing & Gates', 'Farm Fencing & Gates'], ratingCount: 0, index: 2 },
  { itemId: '335640439', name: 'Solar Pendant Lights Dual Bulb IP65 Waterproof Dusk to Dawn Auto Lamp with Remote for Outdoor Areas Stables Equipment', price: 100.37, uom: 'each', category: ['Lumber & Composites', 'Fencing & Gates', 'Farm Fencing & Gates'], ratingCount: 1, sponsored: true, index: 3 },
  { itemId: '100180864', name: '10 Amp Single-Pole AC/DC Push Button Door Switch (1-Pack)', price: 16.52, uom: 'set', category: ['Electrical', 'Wiring Devices & Light Controls', 'Light Switches'], ratingCount: 228, index: 4 },
  { itemId: '320487031', name: '15 Amp 24-Hour Outdoor Plug-In Mechanical Dusk to Dawn Countdown Timer with Grounded Outlet, Black', price: 11.98, uom: 'each', category: ['Electrical', 'Wiring Devices & Light Controls', 'Timer Switches'], ratingCount: 3534, index: 5 },
];

/** Real "1/2 inch hardware cloth 3ft x 25ft" results — the security-critical line. */
const HARDWARE_CLOTH_RESULTS: HDCandidate[] = [
  { itemId: '205960848', name: '1/2 in. Mesh x 3 ft. x 25 ft. 19-Gauge Galvanized Steel Hardware Cloth', price: 75.97, uom: 'roll', category: ['Lumber & Composites', 'Fencing & Gates', 'Hardware Cloth Fencing'], ratingCount: 1321, index: 0 },
  { itemId: '330190356', name: '1/2 in. x 3 ft. x 25 ft. 19-Gauge Black Vinyl Coated Hardware Cloth, Multiple Use Welded Wire Fencing Roll', price: 25.79, uom: 'roll', category: ['Lumber & Composites', 'Fencing & Gates', 'Hardware Cloth Fencing'], ratingCount: 149, sponsored: true, index: 1 },
  { itemId: '330250730', name: '3 ft. x 25 ft. 16-Gauge Welded Wire Fence, Mesh Size 1/2 in. x 1 in. Multiple Use Galvanized Welded Wire Roll', price: 58.98, uom: 'roll', category: ['Lumber & Composites', 'Fencing & Gates', 'Welded Wire Fencing'], ratingCount: 117, sponsored: true, index: 2 },
  { itemId: '306921503', name: '1/2 in. x 4 ft. x 25 ft. 19-Gauge Hardware Cloth', price: 42.98, uom: 'roll', category: ['Lumber & Composites', 'Fencing & Gates', 'Hardware Cloth Fencing'], ratingCount: 496, sponsored: true, index: 3 },
  { itemId: '321367301', name: '1/2 in. x 3 ft. x 25 ft. 19-Gauge Hardware Cloth', price: 31.34, uom: 'roll', category: ['Lumber & Composites', 'Fencing & Gates', 'Hardware Cloth Fencing'], ratingCount: 13, index: 4 },
  { itemId: '331923116', name: '3 ft. x 25 ft. 1/2 in. 24-Gauge Galvanized Hardware Cloth', price: 57.41, uom: 'each', category: ['Lumber & Composites', 'Fencing & Gates', 'Hardware Cloth Fencing'], ratingCount: 9, index: 5 },
];

describe('pickBest — expensive-but-correct specialty items survive the outlier guard', () => {
  it('picks the $248 automatic chicken door over cheap sponsored motion-sensor switches', () => {
    const spec = parseSpec('automatic chicken coop door kit timer light sensor', 'each');
    const pick = pickBest(spec, { candidates: CHICKEN_DOOR_RESULTS });
    // The outlier guard must NOT bury the expensive-but-correct specialty item.
    expect(pick.chosen?.itemId).toBe('335754385');
    expect(pick.chosen?.price).toBe(248.56);
    // A $248, 0-review, security-critical buy is a "confirm this" pick, not a
    // silent auto-apply — so medium (surfaced for review) is the right call.
    expect(pick.confidence).not.toBe('low');
    expect(pick.confidence).not.toBe('none');
  });

  it('picks a galvanized 1/2 in. hardware cloth roll (not the cheaper vinyl/welded-wire)', () => {
    const spec = parseSpec('1/2 inch hardware cloth 3ft x 25ft', 'roll');
    const pick = pickBest(spec, { candidates: HARDWARE_CLOTH_RESULTS });
    expect(pick.chosen?.itemId).toBe('205960848');
    expect(pick.chosen?.price).toBe(75.97);
  });
});

describe('homeDepotAbsoluteUrl', () => {
  it('absolutizes a canonical path and leaves full URLs alone', () => {
    expect(homeDepotAbsoluteUrl('/p/x/312528776')).toBe('https://www.homedepot.com/p/x/312528776');
    expect(homeDepotAbsoluteUrl('https://www.homedepot.com/p/x/1')).toBe('https://www.homedepot.com/p/x/1');
  });
});
