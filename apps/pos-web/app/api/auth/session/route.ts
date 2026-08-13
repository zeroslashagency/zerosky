// Session cookie endpoint.
//
// The session token must live in an httpOnly cookie so a script injected into
// the page cannot read it. httpOnly cookies can only be set by the server, so
// the login page posts the tokens here and this route writes them.
//
// The browser then sends the cookie automatically on every /api/trpc request
// (see `credentials: 'include'` in app/providers.tsx), and `@zerosky/api`'s
// context reads it from the Cookie header.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthService } from '@zerosky/auth';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  cookieOptions,
  isSecureRequest,
} from '@/lib/session-cookies';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token, refreshToken } =
    (body as { token?: unknown; refreshToken?: unknown }) ?? {};

  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }
  if (refreshToken !== undefined && typeof refreshToken !== 'string') {
    return NextResponse.json({ error: 'refreshToken must be a string' }, { status: 400 });
  }

  // Only store a token this server actually issued. Without this check the
  // endpoint would happily persist an attacker-supplied string as a session.
  try {
    getAuthService().jwt.verify(token, 'access');
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const secure = isSecureRequest(request);
  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: ACCESS_COOKIE,
    value: token,
    ...cookieOptions(secure, SESSION_MAX_AGE_SECONDS),
  });

  if (refreshToken) {
    response.cookies.set({
      name: REFRESH_COOKIE,
      value: refreshToken,
      ...cookieOptions(secure, REFRESH_MAX_AGE_SECONDS),
    });
  }

  return response;
}

/**
 * Revoke the session and clear both cookies.
 *
 * Clearing the cookie alone would leave the token valid until it expires, so
 * the Redis session record is deleted first: that is what actually kills the
 * credential, because the API requires a live session on every request.
 */
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (token) {
    try {
      const service = getAuthService();
      const payload = service.jwt.verify(token, 'access');
      await service.sessions.revoke(payload.sessionId);
    } catch {
      // Already expired, tampered with, or never valid: nothing to revoke.
    }
  }

  const secure = isSecureRequest(request);
  const response = NextResponse.json({ success: true });
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    response.cookies.set({ name, value: '', ...cookieOptions(secure, 0) });
  }
  return response;
}
