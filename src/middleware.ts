import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, isValidAuthCookie } from '@/lib/auth';

/**
 * Simple password gate. There are no user accounts — the whole app sits behind
 * one shared password (default "coop"). The login page sets a SIGNED httpOnly
 * cookie via /api/auth (an HMAC of a server secret, so it can't be forged); this
 * middleware verifies that signature. Unauthenticated page requests redirect to
 * /login; unauthenticated API requests get a 401 JSON (not an HTML redirect).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the login page and the auth endpoint through.
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const authed = await isValidAuthCookie(req.cookies.get(AUTH_COOKIE)?.value);
  if (!authed) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    // Preserve where they were trying to go so we can bounce them back.
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals, the login assets, and files with
  // an extension (images, etc.). API routes are matched so they're protected too.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)'],
};
