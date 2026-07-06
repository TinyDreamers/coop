import type { PriceSource } from '../types';

/**
 * PRICING PROVIDER ABSTRACTION
 *
 * Home Depot has no public pricing API, and scraping is blocked by anti-bot
 * measures + CORS from the browser. So we deliberately abstract "where a price
 * comes from" behind this provider and make the LIVE path best-effort:
 *
 *   - By default the live provider reports "unavailable" and the UI falls back
 *     to the cached seed price or a manual entry — pricing NEVER breaks the app.
 *   - Set HOMEDEPOT_LIVE=1 to enable an experimental server-side lookup. Even
 *     then, any failure returns a graceful `ok: false` result.
 *
 * To plug in a real data source later (an official feed, an affiliate API, a
 * cached price sheet), implement `PriceProvider.lookup` and swap it in.
 */

export interface PriceLookupResult {
  ok: boolean;
  source: PriceSource;
  unitPrice?: number;
  productName?: string;
  sku?: string;
  url?: string;
  /** Human message shown when live pricing is unavailable. */
  message?: string;
}

export interface PriceProvider {
  id: string;
  lookup(searchTerm: string): Promise<PriceLookupResult>;
}

/**
 * Fetch with a hard timeout that actually cancels the request. The abort signal
 * is wired into fetch (constructed inside so it can never hang past `ms`).
 */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Experimental live provider. Attempts a lightweight lookup only when explicitly
 * enabled; otherwise returns a graceful "unavailable" result immediately.
 */
export const liveHomeDepotProvider: PriceProvider = {
  id: 'homedepot-live',
  async lookup(searchTerm: string): Promise<PriceLookupResult> {
    if (process.env.HOMEDEPOT_LIVE !== '1') {
      return {
        ok: false,
        source: 'failed',
        message:
          'Live Home Depot pricing is disabled (no public API). Using cached price — edit or lock a price manually.',
      };
    }
    try {
      // Best-effort: hit Home Depot's public typeahead as a sanity check. We do
      // NOT depend on this succeeding — any error degrades to manual/cached.
      const url = `https://www.homedepot.com/federation-gateway/graphql?opname=typeahead`;
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'user-agent': 'coop-planner' },
          body: JSON.stringify({ searchTerm }),
          cache: 'no-store',
        },
        4000,
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      // Home Depot blocks unauthenticated automated pricing, so we treat a
      // 200 as "reachable" but still hand back manual entry — we never fabricate
      // a price. This keeps the workflow honest.
      return {
        ok: false,
        source: 'failed',
        message:
          'Reached Home Depot but pricing requires manual confirmation. Open the product, then enter/lock the price here.',
      };
    } catch (err) {
      return {
        ok: false,
        source: 'failed',
        message: `Live lookup failed (${
          err instanceof Error ? err.message : 'network'
        }). Using cached price — enter it manually if needed.`,
      };
    }
  },
};

/** Build a Home Depot search URL for a term (used by "Search Home Depot" links). */
export function homeDepotSearchUrl(term: string): string {
  return `https://www.homedepot.com/s/${encodeURIComponent(term)}`;
}

/**
 * Direct product-page link for a Home Depot item. Home Depot resolves the bare
 * `/p/{internetItemId}` short URL to the full product slug, so a numeric SKU /
 * internet item # deep-links straight to the product. Anything non-numeric (a
 * model number, store SKU, etc.) can't be a `/p/` id, so we fall back to a
 * search on that string — which still lands the shopper on the exact product.
 */
export function homeDepotProductUrl(sku: string): string {
  const clean = sku.trim();
  if (!clean || clean.toLowerCase() === 'n/a') return homeDepotSearchUrl('');
  return /^\d{6,}$/.test(clean)
    ? `https://www.homedepot.com/p/${encodeURIComponent(clean)}`
    : homeDepotSearchUrl(clean);
}

/**
 * Try to pull a Home Depot internet item # out of a pasted product URL, e.g.
 * `https://www.homedepot.com/p/Some-Product-Name/318534512` → `318534512`.
 * Returns null when the string isn't a recognizable HD product URL.
 */
export function extractHomeDepotItemId(url: string): string | null {
  const m = url.match(/homedepot\.com\/p\/(?:[^/]+\/)*(\d{6,})/i);
  return m ? m[1] : null;
}

/**
 * The best Home Depot link for a material line, in priority order:
 *   1. an explicit product URL the user locked,
 *   2. a direct product page derived from a locked SKU,
 *   3. a text search on the editable search term.
 * Everything opens in the user's own browser, where they're a cleared shopper —
 * which is the only reliable way to reach Home Depot (server-side is bot-blocked).
 */
export function homeDepotItemUrl(item: {
  homeDepotUrl?: string;
  homeDepotSku?: string;
  searchTerm: string;
}): string {
  if (item.homeDepotUrl && /^https?:\/\//i.test(item.homeDepotUrl)) return item.homeDepotUrl;
  if (item.homeDepotSku && item.homeDepotSku.toLowerCase() !== 'n/a') {
    return homeDepotProductUrl(item.homeDepotSku);
  }
  return homeDepotSearchUrl(item.searchTerm);
}

/** True when a material line points at a specific locked product (not a search). */
export function hasLockedProduct(item: { homeDepotUrl?: string; homeDepotSku?: string }): boolean {
  return Boolean(
    (item.homeDepotUrl && /^https?:\/\//i.test(item.homeDepotUrl)) ||
      (item.homeDepotSku && item.homeDepotSku.toLowerCase() !== 'n/a'),
  );
}

export const activeProvider: PriceProvider = liveHomeDepotProvider;
