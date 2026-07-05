import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Simple password gate. There are no user accounts — the whole app sits behind
 * one shared password (default "coop"). The login page sets an httpOnly cookie
 * via /api/auth; this middleware redirects any unauthenticated request for a
 * page to /login. API routes and static assets are excluded via the matcher.
 */
const AUTH_COOKIE = 'coop_auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the login page and the auth endpoint through.
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const authed = req.cookies.get(AUTH_COOKIE)?.value === 'ok';
  if (!authed) {
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
  // an extension (images, etc.). API routes handle their own auth as needed.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)'],
};
