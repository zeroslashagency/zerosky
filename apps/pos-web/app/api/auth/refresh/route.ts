// Access-token rotation.
//
// Both tokens are httpOnly, so the client cannot perform the exchange itself:
// it just POSTs here and the server reads the refresh cookie, rotates it, and
// writes the new pair back.
//
// Rotation is enforced by SessionManager: presenting a stale refresh token
// revokes the whole session, which is how token theft is contained.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { refreshSession } from '@zerosky/auth';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  cookieOptions,
  isSecureRequest,
} from '@/lib/session-cookies';

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: 'No session' }, { status: 401 });
  }

  const secure = isSecureRequest(request);

  let issued;
  try {
    issued = await refreshSession(refreshToken);
  } catch {
    // Expired, tampered, or a replayed token (which just revoked the session).
    const failure = NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
      failure.cookies.set({ name, value: '', ...cookieOptions(secure, 0) });
    }
    return failure;
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: issued.accessToken,
    ...cookieOptions(secure, SESSION_MAX_AGE_SECONDS),
  });
  response.cookies.set({
    name: REFRESH_COOKIE,
    value: issued.refreshToken,
    ...cookieOptions(secure, REFRESH_MAX_AGE_SECONDS),
  });
  return response;
}
