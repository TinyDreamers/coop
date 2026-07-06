/**
 * Auth token helper — shared by the middleware (edge runtime) and the /api/auth
 * route (node runtime). Both use the Web Crypto API, which is available in both.
 *
 * The gate cookie value is an HMAC of a constant, keyed by AUTH_SECRET (a
 * server-only env var). Because the value is derived from a secret an attacker
 * cannot see, it can't be forged the way a static sentinel like "ok" could.
 */

export const AUTH_COOKIE = 'coop_auth';

const TOKEN_MESSAGE = 'coop-auth-v1';

let cached: string | null = null;

/** Compute the expected signed cookie value. Cached per process. */
export async function authToken(): Promise<string> {
  if (cached) return cached;
  const secret = process.env.AUTH_SECRET || 'dev-secret-change-me';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(TOKEN_MESSAGE));
  cached = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return cached;
}

/** Constant-time-ish comparison of the presented cookie against the expected token. */
export async function isValidAuthCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const expected = await authToken();
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
