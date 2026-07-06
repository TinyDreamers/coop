/**
 * Adaptive lumber stock selection.
 *
 * Many framing members' lengths scale with a user-editable dimension (a joist =
 * coop depth, a plate = coop width, a rafter = roof slope, a stud = wall height).
 * The design sliders allow those dimensions well past what a single fixed board
 * covers, so stock length MUST be chosen from the required length — otherwise the
 * cut list shows uncuttable pieces and the BOM under-buys. This helper picks the
 * smallest standard board that fits, and splices when a piece would exceed 16 ft.
 */

export type LumberNominal = '2x4' | '2x6' | '2x8' | '4x4pt';

// Standard stocked lengths (ft) and their cached Concord-NH prices. Refreshed
// 2026-07-06 from a live Home Depot scrape of the signed-in Concord store
// (#3485); lengths not returned by that sweep keep their prior estimate.
const LUMBER_PRICE_TABLE: Record<LumberNominal, Record<number, number>> = {
  '2x4': { 8: 3.98, 10: 5.67, 12: 6.82, 16: 9.12 },
  '2x6': { 8: 8.98, 10: 11.28, 12: 13.52, 16: 17.82 },
  '2x8': { 8: 10.72, 10: 13.42, 12: 16.12, 16: 21.43 },
  '4x4pt': { 8: 11.28, 12: 22.58, 16: 32.98 },
};

function nominalLabel(n: LumberNominal): string {
  return n === '4x4pt' ? '4x4' : n;
}
function nominalSearchSuffix(n: LumberNominal): string {
  return n === '4x4pt' ? 'pressure treated' : 'lumber';
}

export interface StockPick {
  /** The board length to BUY (ft). */
  lengthFt: number;
  /** The finished cut length per piece (ft) — never exceeds lengthFt. */
  pieceLengthFt: number;
  /** How many pieces one member takes (>1 means splice over a support). */
  pieces: number;
  /** Unit price of the chosen board. */
  price: number;
  /** Editable Home Depot search term for the chosen board. */
  searchTerm: string;
  /** e.g. "2x8 x 12 ft" or "4x4 x 16 ft PT". */
  label: string;
}

/**
 * Choose the smallest standard board that yields a `requiredFt` piece. If the
 * piece is longer than the longest stocked board, split it into equal spliced
 * pieces that each fit.
 */
export function pickLumber(nominal: LumberNominal, requiredFt: number): StockPick {
  const table = LUMBER_PRICE_TABLE[nominal];
  const lengths = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const maxLen = lengths[lengths.length - 1];
  const req = Math.max(0.5, requiredFt);

  const pt = nominal === '4x4pt' ? ' PT' : '';

  if (req <= maxLen + 1e-6) {
    const lengthFt = lengths.find((l) => l >= req - 1e-6) ?? maxLen;
    return {
      lengthFt,
      pieceLengthFt: req,
      pieces: 1,
      price: table[lengthFt],
      searchTerm: `${nominalLabel(nominal)}x${lengthFt} ${nominalSearchSuffix(nominal)}`,
      label: `${nominalLabel(nominal)} x ${lengthFt} ft${pt}`,
    };
  }

  // Too long for one board — splice into equal pieces that each fit 16 ft.
  const pieces = Math.ceil(req / maxLen);
  return {
    lengthFt: maxLen,
    pieceLengthFt: req / pieces,
    pieces,
    price: table[maxLen],
    searchTerm: `${nominalLabel(nominal)}x${maxLen} ${nominalSearchSuffix(nominal)}`,
    label: `${nominalLabel(nominal)} x ${maxLen} ft${pt}`,
  };
}
