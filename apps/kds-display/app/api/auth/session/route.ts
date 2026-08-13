// Session cookie endpoint for the kitchen display.
//
// Mirrors apps/pos-web/app/api/auth/session/route.ts. The token is httpOnly so
// an injected script cannot read it, and httpOnly cookies can only be set by a
// server response, hence this route. Cookie lifetimes live in
// lib/session-cookies.ts (shift-length rather than 15 minutes).

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthService } from '@zerosky/auth';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  SHIFT_MAX_AGE_SECONDS,
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

  // Only persist a token this server actually issued.
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
    ...cookieOptions(secure, SHIFT_MAX_AGE_SECONDS),
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

/** Revoke the Redis session and clear both cookies. */
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (token) {
    try {
      const service = getAuthService();
      const payload = service.jwt.verify(token, 'access');
      await service.sessions.revoke(payload.sessionId);
    } catch {
      // Nothing valid to revoke.
    }
  }

  const secure = isSecureRequest(request);
  const response = NextResponse.json({ success: true });
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    response.cookies.set({ name, value: '', ...cookieOptions(secure, 0) });
  }
  return response;
}
