/**
 * Shared session-cookie configuration for the kitchen display.
 *
 * Lives outside the route handlers because Next.js route files may only export
 * HTTP method handlers and a small set of known config keys.
 *
 * Deliberate difference from pos-web: kitchen tablets stay signed in for a full
 * shift rather than 15 minutes, so unattended screens do not time out
 * mid-service. That is a longer exposure window for a stolen token, which is
 * why the token is now a signed, revocable session rather than a raw user id.
 */
import type { NextRequest } from 'next/server';

export const ACCESS_COOKIE = 'auth_token';
export const REFRESH_COOKIE = 'auth_refresh_token';

/** Shift-length session for kitchen tablets (vs 15 minutes on pos-web). */
export const SHIFT_MAX_AGE_SECONDS = 2 * 60 * 60;

/** Refresh token outlives the shift so the display can rotate its access token. */
export const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function isSecureRequest(request: NextRequest): boolean {
  const proto = request.headers.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0]!.trim() === 'https';
  return new URL(request.url).protocol === 'https:';
}

export function cookieOptions(secure: boolean, maxAge: number) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
