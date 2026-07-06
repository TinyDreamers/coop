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

export const activeProvider: PriceProvider = liveHomeDepotProvider;
