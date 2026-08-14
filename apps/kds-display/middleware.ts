import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Routes reachable without a session.
 *
 * Everything else requires authentication: this middleware is deliberately
 * default-deny. Modelled on apps/pos-web/middleware.ts.
 */
const publicRoutes = [
  '/login',
  // tRPC enforces auth per-procedure via protectedProcedure/roleProcedure.
  '/api/trpc',
  // Session cookie endpoints. These MUST be reachable without a session:
  // /api/auth/session is what establishes the cookie at login, and
  // /api/auth/refresh runs when the access token has already expired. Both
  // validate their own credentials (a signed token from auth.login, or the
  // httpOnly refresh cookie), so opening them does not weaken the gate.
  '/api/auth/session',
  '/api/auth/refresh',
];

/** Next.js internals and static assets that must never redirect. */
const alwaysAllowed = ['/_next', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (alwaysAllowed.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isPublic = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (isPublic) {
    return NextResponse.next();
  }

  // Default-deny: any other path needs a session cookie. Presence check only —
  // the cookie is httpOnly and opaque here; its signature and Redis session are
  // verified server-side on every API call.
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (public directory)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
