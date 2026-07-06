import { NextResponse } from 'next/server';
import type { LockedProduct, PriceOverride } from '@/lib/types';
import { buildScrapeManifest, type ScrapeTarget } from '@/lib/pricing/scrapeManifest';
import {
  pickBest,
  homeDepotAbsoluteUrl,
  type HDSearchResult,
  type ScrapePick,
} from '@/lib/pricing/homeDepotScrape';

/**
 * SCRAPE BRIDGE
 *
 * The browser extension does the fetching (it's the only thing that can reach
 * Home Depot past the bot wall). This endpoint is the brain on the other side:
 *
 *   GET  → the deduped manifest of Home Depot lookups for the current design.
 *          The extension driver walks this list, loads each search page, injects
 *          `HD_PAGE_EXTRACTOR`, and collects raw candidates.
 *
 *   POST { results } → run the deterministic matcher over those raw candidates,
 *          pick the correct product per search, and hand back everything ready
 *          to drop into a project: `priceOverrides` + `lockedProducts` keyed by
 *          material id, plus a per-term snapshot and a list of anything the
 *          matcher wasn't confident about.
 *
 * It never mutates the project — it returns import-ready data the client (or the
 * user) applies deliberately.
 */

export const dynamic = 'force-dynamic';

export function GET() {
  const manifest = buildScrapeManifest();
  return NextResponse.json({
    ok: true,
    count: manifest.length,
    targets: manifest.map((t) => ({
      key: t.key,
      searchTerm: t.searchTerm,
      searchUrl: t.searchUrl,
      unit: t.materials[0]?.unit,
      materialIds: t.materials.map((m) => m.id),
    })),
  });
}

/** Accepts either an array of {key?, searchTerm?, result} or a term→result map. */
interface PostBody {
  results?: Array<{ key?: string; searchTerm?: string; result: HDSearchResult }> | Record<string, HDSearchResult>;
  at?: string; // optional ISO timestamp for the produced override/lock records
}

function normalizeResults(body: PostBody): Map<string, HDSearchResult> {
  const map = new Map<string, HDSearchResult>();
  const raw = body.results;
  if (!raw) return map;
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const k = (entry.key || entry.searchTerm || entry.result?.keyword || '').trim().toLowerCase();
      if (k) map.set(k, entry.result);
    }
  } else {
    for (const [k, v] of Object.entries(raw)) map.set(k.trim().toLowerCase(), v);
  }
  return map;
}

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const at = typeof body.at === 'string' ? body.at : new Date().toISOString();
  const results = normalizeResults(body);
  const manifest = buildScrapeManifest();

  const priceOverrides: Record<string, PriceOverride> = {};
  const lockedProducts: Record<string, LockedProduct> = {};
  const picks: Array<{
    key: string;
    searchTerm: string;
    confidence: ScrapePick['confidence'];
    chosen: ScrapePick['chosen'];
    correctedKeyword?: string | null;
    materialIds: string[];
    note?: string;
    alternatives: { itemId: string; name: string; price: number | null }[];
  }> = [];
  // Medium-confidence picks are surfaced for a human to confirm, not auto-applied.
  const suggestions: Array<{
    key: string;
    searchTerm: string;
    materialIds: string[];
    itemId: string;
    name: string;
    price: number | null;
    url?: string;
    note?: string;
  }> = [];
  const unmatched: Array<{ key: string; searchTerm: string; reason: string; materialIds: string[] }> = [];

  for (const target of manifest as ScrapeTarget[]) {
    const result = results.get(target.key) ?? matchByKeyword(results, target);
    const materialIds = target.materials.map((m) => m.id);

    if (!result || !result.candidates?.length) {
      unmatched.push({ key: target.key, searchTerm: target.searchTerm, reason: 'no candidates collected', materialIds });
      continue;
    }

    const pick = pickBest(target.spec, result);
    picks.push({
      key: target.key,
      searchTerm: target.searchTerm,
      confidence: pick.confidence,
      chosen: pick.chosen,
      correctedKeyword: pick.correctedKeyword,
      materialIds,
      note: pick.note,
      alternatives: pick.alternatives.map((a) => ({ itemId: a.cand.itemId, name: a.cand.name, price: a.cand.price })),
    });

    const chosen = pick.chosen;
    const price = chosen?.price ?? null;
    const url = chosen?.url ? homeDepotAbsoluteUrl(chosen.url) : undefined;

    // No usable price → unmatched (keep the seed/cached price).
    if (!chosen || price == null || pick.confidence === 'low' || pick.confidence === 'none') {
      unmatched.push({
        key: target.key,
        searchTerm: target.searchTerm,
        reason: chosen ? `low-confidence pick ($${price ?? '?'})` : 'no usable pick',
        materialIds,
      });
      continue;
    }

    // Medium confidence → suggest, don't auto-apply (a human eyeballs which product).
    if (pick.confidence === 'medium') {
      suggestions.push({
        key: target.key,
        searchTerm: target.searchTerm,
        materialIds,
        itemId: chosen.itemId,
        name: chosen.name,
        price,
        url,
        note: pick.note,
      });
      continue;
    }

    // High confidence → auto-apply an importable price + locked product per line.
    for (const m of target.materials) {
      priceOverrides[m.id] = { unitPrice: price, source: 'cached', updatedAt: at, note: `HD ${chosen.itemId}` };
      lockedProducts[m.id] = {
        sku: chosen.itemId || 'n/a',
        name: chosen.name || m.name,
        url,
        unitPrice: price,
        priceSource: 'cached',
        lockedAt: at,
      };
    }
  }

  return NextResponse.json({
    ok: true,
    storeName: firstStoreName(results),
    summary: {
      targets: manifest.length,
      autoPriced: Object.keys(lockedProducts).length,
      suggested: suggestions.length,
      unmatched: unmatched.length,
      high: picks.filter((p) => p.confidence === 'high').length,
      medium: picks.filter((p) => p.confidence === 'medium').length,
    },
    picks,
    suggestions,
    unmatched,
    priceOverrides,
    lockedProducts,
  });
}

/** Fall back to matching a collected result by its (corrected) keyword. */
function matchByKeyword(results: Map<string, HDSearchResult>, target: ScrapeTarget): HDSearchResult | undefined {
  for (const r of results.values()) {
    const kw = (r.keyword || '').trim().toLowerCase();
    if (kw && kw === target.key) return r;
  }
  return undefined;
}

function firstStoreName(results: Map<string, HDSearchResult>): string | null {
  for (const r of results.values()) if (r.storeName) return r.storeName;
  return null;
}
