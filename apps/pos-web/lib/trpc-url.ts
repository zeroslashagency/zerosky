/**
 * Resolve the tRPC endpoint.
 *
 * The session token now lives in an httpOnly, SameSite=Lax cookie, so the
 * browser only attaches it to same-origin requests. Each app hosts its own
 * `/api/trpc` route handler, so the same-origin relative path is both the
 * simplest and the only reliably authenticated choice.
 *
 * `NEXT_PUBLIC_API_URL` is still honoured when it points at this same origin
 * (the common local setup) and is otherwise ignored in the browser, because a
 * cross-origin call would silently drop the cookie and 401 every request.
 */
export const TRPC_PATH = '/api/trpc';

export function resolveTrpcUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window === 'undefined') {
    return configured || `http://localhost:3000${TRPC_PATH}`;
  }

  if (!configured) return TRPC_PATH;

  try {
    const url = new URL(configured, window.location.origin);
    if (url.origin === window.location.origin) {
      return url.pathname + url.search;
    }
    // Cross-origin: the httpOnly SameSite=Lax cookie would not be sent.
    console.warn(
      `[zerosky] NEXT_PUBLIC_API_URL (${configured}) is cross-origin; ` +
        `falling back to ${TRPC_PATH} so the session cookie is sent.`,
    );
    return TRPC_PATH;
  } catch {
    return TRPC_PATH;
  }
}
