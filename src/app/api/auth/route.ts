import { NextResponse } from 'next/server';
import { AUTH_COOKIE, authToken } from '@/lib/auth';

/**
 * Password gate endpoint. No accounts — one shared password (default "coop",
 * override with APP_PASSWORD). On success we set a SIGNED httpOnly cookie
 * (HMAC of a server secret) that the middleware verifies. DELETE logs out.
 */
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(req: Request) {
  let password = '';
  try {
    const body = await req.json();
    password = String(body?.password ?? '');
  } catch {
    // ignore malformed body
  }

  const expected = process.env.APP_PASSWORD || 'coop';
  if (password !== expected) {
    return NextResponse.json({ ok: false, error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: THIRTY_DAYS,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
