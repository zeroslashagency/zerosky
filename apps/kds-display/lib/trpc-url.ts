/**
 * Resolve the tRPC endpoint.
 *
 * The session token is an httpOnly, SameSite=Lax cookie, so the browser only
 * attaches it to same-origin requests. This app hosts its own `/api/trpc` route
 * handler, so the relative path is the only reliably authenticated choice.
 *
 * `NEXT_PUBLIC_API_URL` is honoured when same-origin and ignored otherwise,
 * because a cross-origin call would drop the cookie and 401 every request.
 */
export const TRPC_PATH = '/api/trpc';

export function resolveTrpcUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window === 'undefined') {
    return configured || `http://localhost:3002${TRPC_PATH}`;
  }

  if (!configured) return TRPC_PATH;

  try {
    const url = new URL(configured, window.location.origin);
    if (url.origin === window.location.origin) {
      return url.pathname + url.search;
    }
    console.warn(
      `[zerosky] NEXT_PUBLIC_API_URL (${configured}) is cross-origin; ` +
        `falling back to ${TRPC_PATH} so the session cookie is sent.`,
    );
    return TRPC_PATH;
  } catch {
    return TRPC_PATH;
  }
}
