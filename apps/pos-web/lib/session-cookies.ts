/**
 * Shared session-cookie configuration.
 *
 * Lives outside the route handlers because Next.js route files may only export
 * HTTP method handlers and a small set of known config keys.
 */
import type { NextRequest } from 'next/server';

export const ACCESS_COOKIE = 'auth_token';
export const REFRESH_COOKIE = 'auth_refresh_token';

/** Idle session lifetime. Matches the client-side timers in lib/auth-context. */
export const SESSION_MAX_AGE_SECONDS = 15 * 60;

/** Refresh token lives longer so an idle-expired session can be resumed. */
export const REFRESH_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** True when the request reached us over HTTPS (directly or via a proxy). */
export function isSecureRequest(request: NextRequest): boolean {
  const proto = request.headers.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0]!.trim() === 'https';
  return new URL(request.url).protocol === 'https:';
}

/** Cookie attributes shared by every session cookie write. */
export function cookieOptions(secure: boolean, maxAge: number) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
