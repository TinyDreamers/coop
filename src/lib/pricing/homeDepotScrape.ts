import { homeDepotSearchUrl } from './provider';

/**
 * HOME DEPOT SCRAPER — extraction + matching core.
 *
 * WHY THIS EXISTS
 * ---------------
 * Home Depot has no public pricing API and blocks server-side / headless
 * scraping (see the note in `provider.ts`). The ONLY reliable way to read a
 * price is inside the user's real, signed-in browser — where they're a cleared
 * shopper. So this module is split into two halves:
 *
 *   1. `HD_PAGE_EXTRACTOR` — a self-contained snippet that runs *inside* a
 *      homedepot.com search page (injected via the Chrome extension) and returns
 *      structured product candidates. It reads Apollo's normalized GraphQL cache
 *      (`window.__APOLLO_STATE__`) which is the exact data the page rendered from
 *      — far more robust than scraping CSS classes that change weekly. A DOM
 *      fallback is included for the rare page that ships without the cache.
 *
 *   2. The pure TypeScript below (`parseSpec`, `scoreCandidate`, `pickBest`) —
 *      the intelligence that turns "here are 22 products for '2x4x8 stud'" into
 *      "THIS one is the 2x4x8 framing stud you actually want" and NOT the $115
 *      LVL boxed set, the $91 cedar 4-pack, or the 4x4 deck post that Home
 *      Depot's search happily mixes in. This half is deterministic and unit
 *      tested against captured real search results.
 *
 * The two halves talk through the `HDCandidate` shape, so the fragile,
 * DOM-coupled part is tiny and isolated, and the valuable ranking logic is plain
 * testable code.
 */

// ---------------------------------------------------------------------------
// Shared shapes (produced by the in-page extractor, consumed by the matcher)
// ---------------------------------------------------------------------------

/** One product as pulled off a Home Depot search results page. */
export interface HDCandidate {
  itemId: string; // Home Depot "internet #", e.g. "312528776"
  name: string; // productLabel, e.g. "2 in. x 4 in. x 96 in. #2 Premium Grade KD-HT Stud"
  brand?: string | null;
  model?: string | null;
  storeSku?: string | null;
  url?: string | null; // canonical path, e.g. "/p/...-058449/312528776"
  price: number | null; // resolved store price (may be null if hidden)
  original?: number | null;
  uom?: string | null; // unit of measure: "each" | "set" | "case" | "sq. ft." ...
  category?: string[]; // categoryHierarchy, e.g. ["Lumber & Composites","Dimensional Lumber","Framing Studs"]
  sponsored?: boolean | null;
  hidePrice?: boolean | null;
  buyable?: boolean | null; // online-buyable (false for store-only lumber — still valid)
  availType?: string | null; // "Browse Only" | "Online" | ...
  discontinued?: boolean | null;
  ratingCount?: number | null;
  rating?: number | null;
  index?: number; // position in Home Depot's BEST_MATCH ordering (0 = first)
}

/** The full result of extracting one search page. */
export interface HDSearchResult {
  keyword: string;
  correctedKeyword?: string | null; // set when HD auto-corrected the search
  totalProducts?: number | null;
  storeId?: string | null;
  storeName?: string | null;
  candidates: HDCandidate[];
  source: 'apollo' | 'dom' | 'none';
  error?: string;
}

// ---------------------------------------------------------------------------
// The in-page extractor (injected into a homedepot.com search tab)
// ---------------------------------------------------------------------------

/**
 * JavaScript evaluated INSIDE a Home Depot search page. Returns an
 * `HDSearchResult` (as a plain object). Kept as a string so it can be handed
 * straight to the browser extension's `javascript_tool`. It is intentionally
 * defensive: Home Depot ships slightly different cache shapes across page
 * templates, so we locate the search node structurally (a node that owns a
 * `searchReport` plus a `products(...)` field) instead of by a hard-coded key.
 */
export const HD_PAGE_EXTRACTOR = /* js */ `(() => {
  const parseNum = (v) => {
    if (v == null) return null;
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };
  try {
    const s = window.__APOLLO_STATE__ || {};
    const resolve = (x) => (x && x.__ref) ? s[x.__ref] : x;
    // Locate the search-model node: it owns a searchReport and a products(...) field.
    let node = null;
    for (const k of Object.keys(s)) {
      const v = s[k];
      if (v && typeof v === 'object' && v.searchReport &&
          Object.keys(v).some((kk) => kk.indexOf('products(') === 0)) { node = v; break; }
    }
    if (node) {
      const report = node.searchReport || {};
      const meta = node.metadata || {};
      const stores = meta.stores || {};
      const pkey = Object.keys(node).find((k) => k.indexOf('products(') === 0);
      const arr = (pkey && node[pkey]) || [];
      const candidates = arr.map((ref, i) => {
        const p = resolve(ref);
        if (!p) return null;
        const id = p.identifiers || {};
        const info = p.info || {};
        const avail = p.availabilityType || {};
        const pricingKey = Object.keys(p).find((k) => k.indexOf('pricing(') === 0);
        const pr = pricingKey ? p[pricingKey] : null;
        const rev = resolve(p.reviews) || {};
        const ratings = resolve(rev.ratingsReviews) || rev.ratingsReviews || {};
        return {
          itemId: id.itemId || String(p.itemId || ''),
          name: id.productLabel || '',
          brand: id.brandName || null,
          model: id.modelNumber || null,
          storeSku: id.storeSkuNumber || id.omsThdSku || null,
          url: id.canonicalUrl || null,
          price: pr && typeof pr.value === 'number' ? pr.value : null,
          original: pr && typeof pr.original === 'number' ? pr.original : null,
          uom: pr ? pr.unitOfMeasure || null : null,
          category: Array.isArray(info.categoryHierarchy) ? info.categoryHierarchy : [],
          sponsored: info.isSponsored === true,
          hidePrice: info.hidePrice === true,
          buyable: typeof avail.buyable === 'boolean' ? avail.buyable : null,
          availType: avail.type || null,
          discontinued: avail.discontinued === true,
          ratingCount: parseNum(ratings.totalReviews != null ? ratings.totalReviews : rev.totalReviews),
          rating: (() => { const r = parseFloat(ratings.averageRating != null ? ratings.averageRating : rev.averageRating); return Number.isFinite(r) ? r : null; })(),
          index: i,
        };
      }).filter(Boolean);
      return {
        keyword: report.keyword || '',
        correctedKeyword: report.correctedKeyword || null,
        totalProducts: typeof report.totalProducts === 'number' ? report.totalProducts : null,
        storeId: stores.storeId || null,
        storeName: stores.storeName || null,
        candidates,
        source: 'apollo',
      };
    }

    // ---- DOM fallback: read visible product pods -------------------------
    const pods = [...document.querySelectorAll('[data-testid="product-pod"]')];
    const candidates = pods.map((pod, i) => {
      const a = pod.querySelector('a[href*="/p/"]');
      const href = a ? a.getAttribute('href') : null;
      const m = href ? href.match(/\\/p\\/(?:[^/]+\\/)*([0-9]{6,})/) : null;
      const priceEl = pod.querySelector('[class*="price-format__main-price"], [data-testid*="price"]');
      const priceTxt = priceEl ? priceEl.textContent : '';
      const pm = priceTxt.match(/([0-9]+(?:\\.[0-9]{2})?)/);
      return {
        itemId: m ? m[1] : '',
        name: (pod.querySelector('[data-testid="attribute-product-label"], [data-testid="product-header"]')?.textContent || pod.innerText || '').trim().slice(0, 200),
        url: href,
        price: pm ? parseFloat(pm[1]) : null,
        category: [],
        index: i,
      };
    }).filter((c) => c.itemId);
    return { keyword: '', candidates, source: candidates.length ? 'dom' : 'none' };
  } catch (e) {
    return { keyword: '', candidates: [], source: 'none', error: String(e && e.message || e) };
  }
})()`;

// ---------------------------------------------------------------------------
// Spec parsing — turn a search term (+ its material unit) into matchable facts
// ---------------------------------------------------------------------------

/** Structured requirements distilled from a material line's search term. */
export interface MaterialSpec {
  raw: string;
  unit?: string;
  /** Normalized nominal cross-section, sides sorted ascending, e.g. "2x4". */
  nominal?: string;
  /** Marketed length in feet for lumber / panels / cords (8, 10, 12, 16, 50…). */
  lengthFt?: number;
  /** True when the term describes a 4x8 sheet good. */
  sheet?: boolean;
  /** Sheet/panel thickness token as written, e.g. "3/4", "1/2", "7/16". */
  thickness?: string;
  /** Wire/cord gauge, e.g. 12 or 19. */
  gauge?: number;
  /** Roll dimensions in feet, e.g. { wFt: 3, lenFt: 25 }. */
  rollDims?: { wFt: number; lenFt: number };
  /** True when a packaged/multi listing is the expected purchase (box, pack…). */
  wantsPack: boolean;
  /** True when the term explicitly wants pressure-treated / ground-contact stock. */
  wantsPT: boolean;
  /** Significant lowercase tokens used for keyword overlap scoring. */
  keywords: string[];
}

/** Units where the *listing itself* is a package — don't penalize pack/case UOM. */
const PACKAGED_UNITS = new Set(['box', 'pack', 'set', 'case', 'tube', 'bale', 'bag', 'pad', 'roll']);

/** Words that never help discriminate and would dilute keyword overlap. */
const STOP_WORDS = new Set([
  'in', 'inch', 'inches', 'ft', 'feet', 'foot', 'x', 'the', 'for', 'with', 'and',
  'a', 'of', 'lb', 'lbs', 'pack', 'kit', 'each',
]);

/** Parse a mixed fraction like "92-5/8" or "3/4" or "1-1/2" into a number. */
export function parseFraction(str: string): number | null {
  const s = str.trim();
  // whole-and-fraction "92-5/8" or "1 1/2"
  let m = s.match(/^(\d+)[\s-](\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]);
  return null;
}

/** Sort the two cross-section numbers ascending so "4x2" and "2x4" unify. */
function normNominal(a: string, b: string): string {
  const na = Number(a);
  const nb = Number(b);
  return na <= nb ? `${na}x${nb}` : `${nb}x${na}`;
}

export function parseSpec(searchTerm: string, unit?: string): MaterialSpec {
  const raw = searchTerm.trim();
  const lc = raw.toLowerCase();
  const spec: MaterialSpec = {
    raw,
    unit,
    wantsPack: unit ? PACKAGED_UNITS.has(unit.toLowerCase()) : false,
    wantsPT: /\b(pt|pressure[\s-]?treated|ground[\s-]?contact)\b/.test(lc),
    keywords: [],
  };

  // Dimensional lumber "2x4x8" / "4x4x12" (WxHxLengthFt).
  const dim3 = lc.match(/\b(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\b/);
  if (dim3) {
    spec.nominal = normNominal(dim3[1], dim3[2]);
    spec.lengthFt = Number(dim3[3]);
  }

  // Sheet goods "4x8" (only when NOT a 3-part lumber dim).
  if (!dim3 && /\b4\s*x\s*8\b/.test(lc)) spec.sheet = true;

  // Roll "3ft x 25ft" / "3 ft x 25 ft".
  const roll = lc.match(/(\d+)\s*ft\s*x\s*(\d+)\s*ft/);
  if (roll) spec.rollDims = { wFt: Number(roll[1]), lenFt: Number(roll[2]) };

  // Standalone length "10 ft" / "50ft" (panels, cords) when no lumber dim set.
  if (spec.lengthFt == null) {
    const len = lc.match(/\b(\d+)\s*ft\b/);
    if (len && !roll) spec.lengthFt = Number(len[1]);
  }

  // Thickness fraction "3/4", "1/2", "7/16" (sheet goods).
  const thick = raw.match(/\b(\d+\/\d+)\b/);
  if (thick) spec.thickness = thick[1];

  // Gauge "12 gauge" / "19 ga".
  const gauge = lc.match(/\b(\d+)\s*(?:ga|gauge)\b/);
  if (gauge) spec.gauge = Number(gauge[1]);

  // Packaged intent from the term itself (weight/count based fasteners etc.).
  if (/\b\d+\s*(?:lb|lbs|pack|count|ct|pc|piece)\b/.test(lc) || /\bbox\b/.test(lc)) {
    spec.wantsPack = true;
  }

  // Keyword set: strip dimensions/units, keep discriminating words.
  spec.keywords = lc
    .replace(/\b\d+\s*x\s*\d+(?:\s*x\s*\d+)?\b/g, ' ')
    .replace(/\b\d+\/\d+\b/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  return spec;
}

// ---------------------------------------------------------------------------
// Candidate parsing — extract comparable facts from a product name
// ---------------------------------------------------------------------------

interface CandidateFacts {
  nominal?: string; // "2x4" from "2 in. x 4 in."
  lengthFt?: number; // 8 from "96 in." or "8 ft." or "92-5/8 in."
  isMultiPack: boolean; // "(4-Pack)", "3-Piece per Box", "Case of 50", uom set/case
  isPT: boolean; // pressure treated / ground contact
}

const MULTIPACK_RE =
  /\((\d+)[\s-]?(?:pack|pk|piece|pieces|ct|count)\b|\b\d+[\s-]?piece per (?:box|case)\b|\bcase of \d+\b|\bbundle of \d+\b|\b\d+[\s-]pack\b/i;

/** Parse the comparable facts out of a candidate's name + unit of measure. */
export function candidateFacts(cand: HDCandidate): CandidateFacts {
  const name = cand.name || '';
  const lc = name.toLowerCase();
  const facts: CandidateFacts = {
    isMultiPack:
      MULTIPACK_RE.test(name) ||
      ['set', 'case', 'box', 'package', 'pallet', 'bundle'].includes((cand.uom || '').toLowerCase()),
    isPT: /\b(pressure[\s-]?treated|ground[\s-]?contact)\b/.test(lc),
  };

  // Cross-section "2 in. x 4 in." (allow decimals for 5/4 etc.).
  const cross = lc.match(/(\d+(?:\.\d+)?)\s*in\.?\s*x\s*(\d+(?:\.\d+)?)\s*in\.?/);
  if (cross) facts.nominal = normNominal(cross[1], cross[2]);

  // Length: the LAST "x <n> in|ft" token. Handles "96 in.", "8 ft.", "92-5/8 in.".
  const lenMatches = [...lc.matchAll(/x\s*([\d][\d\s./-]*?)\s*(in|ft)\b\.?/g)];
  if (lenMatches.length) {
    const last = lenMatches[lenMatches.length - 1];
    const val = parseFraction(last[1].trim());
    if (val != null) facts.lengthFt = last[2] === 'ft' ? val : val / 12;
  }

  return facts;
}

// ---------------------------------------------------------------------------
// Scoring — how well a candidate satisfies a spec
// ---------------------------------------------------------------------------

export interface ScoredCandidate {
  cand: HDCandidate;
  score: number;
  disqualified: boolean;
  /** How many of the spec's keywords appeared in the name/category. */
  hits: number;
  reasons: string[];
}

/** Length match tolerance (ft). Precut studs (92-5/8" ≈ 7.72') read a touch short. */
const LEN_TOL_FT = 0.5;

/**
 * Score one candidate against a spec. Higher is better. `disqualified` marks a
 * candidate that is categorically wrong (e.g. a 4x4 when a 2x4 was asked for);
 * disqualified candidates are only ever chosen if literally nothing else exists.
 */
export function scoreCandidate(spec: MaterialSpec, cand: HDCandidate): ScoredCandidate {
  const reasons: string[] = [];
  let score = 0;
  let disqualified = false;
  const facts = candidateFacts(cand);
  const nameLc = (cand.name || '').toLowerCase();
  const cats = (cand.category || []).map((c) => c.toLowerCase());

  // --- Nominal cross-section: the strongest signal for lumber ---------------
  if (spec.nominal) {
    if (facts.nominal && facts.nominal === spec.nominal) {
      score += 45;
      reasons.push(`nominal ${spec.nominal} ✓`);
    } else if (facts.nominal && facts.nominal !== spec.nominal) {
      disqualified = true;
      reasons.push(`nominal ${facts.nominal}≠${spec.nominal} ✗`);
    } else {
      // Candidate name doesn't state a cross-section — mild doubt, not fatal.
      score -= 4;
      reasons.push('nominal not stated');
    }
  }

  // --- Length ---------------------------------------------------------------
  if (spec.lengthFt != null) {
    if (facts.lengthFt != null) {
      const diff = Math.abs(facts.lengthFt - spec.lengthFt);
      if (diff <= LEN_TOL_FT) {
        score += 30;
        reasons.push(`length ${spec.lengthFt}ft ✓`);
      } else {
        // Wrong length is a heavy penalty but not an outright DQ (HD sometimes
        // omits/rounds length in the label); a right-dimension board of the
        // wrong length should still lose to the correct one decisively.
        score -= 40;
        reasons.push(`length ${facts.lengthFt.toFixed(2)}≠${spec.lengthFt}ft ✗`);
      }
    } else {
      score -= 3;
      reasons.push('length not stated');
    }
  }

  // --- Multipack / boxed set ------------------------------------------------
  if (facts.isMultiPack && !spec.wantsPack) {
    score -= 60;
    reasons.push('unwanted multipack ✗');
  } else if (facts.isMultiPack && spec.wantsPack) {
    score += 4;
    reasons.push('pack ✓');
  }

  // --- Pressure-treated match ----------------------------------------------
  if (spec.wantsPT) {
    if (facts.isPT) {
      score += 20;
      reasons.push('PT ✓');
    } else {
      score -= 15;
      reasons.push('not PT ✗');
    }
  } else if (facts.isPT) {
    // Didn't ask for PT — PT stock is pricier and wrong for interior framing.
    score -= 18;
    reasons.push('unwanted PT ✗');
  }

  // --- Keyword overlap (name + category) -----------------------------------
  const hay = nameLc + ' ' + cats.join(' ');
  let hits = 0;
  for (const kw of spec.keywords) {
    if (hay.includes(kw)) {
      hits++;
      score += 6;
    }
  }
  if (spec.keywords.length) reasons.push(`keywords ${hits}/${spec.keywords.length}`);

  // --- Gauge ----------------------------------------------------------------
  if (spec.gauge != null) {
    const cm = nameLc.match(/\b(\d+)\s*(?:ga|gauge)\b/);
    if (cm) {
      if (Number(cm[1]) === spec.gauge) {
        score += 10;
        reasons.push(`gauge ${spec.gauge} ✓`);
      } else {
        score -= 12;
        reasons.push(`gauge ${cm[1]}≠${spec.gauge} ✗`);
      }
    }
  }

  // --- Signals: popularity, sponsorship, availability, HD ordering ----------
  if (cand.discontinued) {
    score -= 25;
    reasons.push('discontinued ✗');
  }
  if (cand.sponsored) {
    score -= 8;
    reasons.push('sponsored');
  }
  if (cand.hidePrice || cand.price == null) {
    score -= 30;
    reasons.push('no price');
  }
  // Popularity: log-scaled so a 6000-review staple beats a 27-review oddity,
  // without a runaway product dominating on reviews alone.
  if (cand.ratingCount && cand.ratingCount > 0) {
    score += Math.min(12, Math.log10(cand.ratingCount + 1) * 4);
  }
  // Mild prior toward Home Depot's own BEST_MATCH ordering (earlier = better).
  if (typeof cand.index === 'number') {
    score += Math.max(0, 8 - cand.index * 0.8);
  }

  return { cand, score, disqualified, hits, reasons };
}

// ---------------------------------------------------------------------------
// Pick the best candidate
// ---------------------------------------------------------------------------

/** Median of a numeric list (returns 0 for an empty list). */
function medianOf(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type PickConfidence = 'high' | 'medium' | 'low' | 'none';

export interface ScrapePick {
  searchTerm: string;
  spec: MaterialSpec;
  chosen: HDCandidate | null;
  confidence: PickConfidence;
  /** Runner-up candidates (already scored, best first) for review/override. */
  alternatives: ScoredCandidate[];
  correctedKeyword?: string | null;
  note?: string;
}

/**
 * Rank all candidates for a spec and pick the best. Confidence reflects how
 * clearly the winner beat the field and whether it cleanly matched the spec:
 *  - high:   comfortable margin over the runner-up and a positive, clean score
 *  - medium: it won but the margin is slim (a human may want to eyeball it)
 *  - low:    only disqualified/negative options were available
 *  - none:   no candidates at all
 */
export function pickBest(
  spec: MaterialSpec,
  result: Pick<HDSearchResult, 'candidates' | 'correctedKeyword'>,
): ScrapePick {
  const cands = result.candidates || [];
  if (!cands.length) {
    return { searchTerm: spec.raw, spec, chosen: null, confidence: 'none', alternatives: [], correctedKeyword: result.correctedKeyword, note: 'no candidates' };
  }

  const scored = cands.map((c) => scoreCandidate(spec, c));

  // Relative price-outlier guard. A candidate can match the dimensions perfectly
  // yet be the wrong PRODUCT — a $70 hardwood board or a $115 LVL "2x4x8" set for
  // a $4 framing stud. Those betray themselves by price: penalize anything priced
  // far above the median of the still-viable candidates. This is relative (not a
  // hard dollar cap) so a genuinely premium category — where every result is
  // pricey — has a high median and no false outliers.
  const viable = scored.filter((s) => !s.disqualified && s.cand.price != null).map((s) => s.cand.price as number);
  if (viable.length >= 4) {
    const median = medianOf(viable);
    const cap = median * 3.5;
    // A strong keyword match is EXEMPT from the outlier penalty: an expensive
    // specialty item (a $248 automatic chicken door that matches 7/8 query words)
    // surrounded by cheap generic noise is the right pick, not an impostor. Only
    // guard candidates that don't clearly answer the query.
    const maxHits = Math.max(0, ...scored.map((s) => s.hits));
    const exemptHits = maxHits >= 2 ? maxHits : Infinity; // never exempt on a lone weak keyword
    if (median > 0) {
      for (const s of scored) {
        if (s.cand.price != null && s.cand.price > cap && s.hits < exemptHits) {
          const over = s.cand.price / median;
          s.score -= Math.min(60, 20 + over * 4);
          s.reasons.push(`price outlier $${s.cand.price} vs med $${median.toFixed(2)} ✗`);
        }
      }
    }
  }

  scored.sort((a, b) => {
    if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: more reviews, then lower price.
    const ra = a.cand.ratingCount || 0;
    const rb = b.cand.ratingCount || 0;
    if (rb !== ra) return rb - ra;
    return (a.cand.price ?? Infinity) - (b.cand.price ?? Infinity);
  });

  const best = scored[0];
  const runnerUp = scored[1];
  const margin = runnerUp ? best.score - runnerUp.score : best.score;

  let confidence: PickConfidence;
  if (best.disqualified || best.score <= 0) confidence = 'low';
  else if (best.score >= 45 && (margin >= 15 || !runnerUp)) confidence = 'high';
  else confidence = 'medium';

  return {
    searchTerm: spec.raw,
    spec,
    chosen: best.cand,
    confidence,
    alternatives: scored.slice(1, 6),
    correctedKeyword: result.correctedKeyword,
    note: best.disqualified ? 'best option is a weak match — verify manually' : undefined,
  };
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/** Turn a canonical product path ("/p/.../312528776") into an absolute URL. */
export function homeDepotAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `https://www.homedepot.com${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

/** The canonical search URL for a term (re-exported for the runner's manifest). */
export { homeDepotSearchUrl };
