import { NextResponse } from 'next/server';
import { activeProvider, homeDepotSearchUrl } from '@/lib/pricing/provider';

/**
 * Pricing lookup endpoint. Delegates to the active price provider and always
 * returns a graceful result (never a 500). The client uses `ok` to decide
 * whether to adopt a live price or keep the cached/manual one.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const term = searchParams.get('term') ?? '';
  if (!term) {
    return NextResponse.json({ ok: false, source: 'failed', message: 'Missing search term.' });
  }

  try {
    const result = await activeProvider.lookup(term);
    return NextResponse.json({ ...result, searchUrl: homeDepotSearchUrl(term) });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      source: 'failed',
      message: `Lookup error: ${(err as Error).message}`,
      searchUrl: homeDepotSearchUrl(term),
    });
  }
}
