// Auth router.
//
// Sessions are real: login issues a signed access JWT plus a refresh JWT and
// records the session in Redis. `context.ts` requires BOTH a valid signature
// and a live Redis session, so `logout` genuinely revokes access.
//
// Previously this returned `{ token: user.id }` and the context looked the user
// up by that id — any leaked user id was a permanent, unrevocable credential.
import { TRPCError } from "@trpc/server";
import {
  getAuthService,
  refreshSession,
  startSession,
  verifyPassword,
  verifyPin,
} from "@zerosky/auth";
import type { Role } from "@zerosky/auth";
import { loginSchema, pinLoginSchema, refreshSchema } from "../schemas/auth.js";
import { authProcedure, protectedProcedure, router } from "../trpc.js";

function toSafeUser(user: { id: string; email: string; name: string; role: string; tenantId: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId };
}

/** Uniform failure so callers cannot distinguish "no such user" from "bad password". */
function invalidCredentials(): TRPCError {
  return new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials." });
}

export const authRouter = router({
  login: authProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
    const tenant = await ctx.db.tenant.findUnique({ where: { slug: input.tenantSlug } });
    if (!tenant || !tenant.isActive) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid tenant." });
    }
    const user = await ctx.db.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
    });
    if (!user || !user.isActive) {
      throw invalidCredentials();
    }
    // Verify the supplied password against the stored bcrypt hash. Without this
    // check any password would authenticate the account.
    const passwordOk = await verifyPassword(input.password, user.passwordHash);
    if (!passwordOk) {
      throw invalidCredentials();
    }

    const session = await startSession({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as Role,
    });

    return {
      // `token` remains the field name so existing clients keep working, but it
      // is now a short-lived signed access token, not the user id.
      token: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.accessTtlSeconds,
      refreshExpiresIn: session.refreshTtlSeconds,
      user: toSafeUser(user),
    };
  }),

  pinLogin: authProcedure.input(pinLoginSchema).mutation(async ({ ctx, input }) => {
    const tenant = await ctx.db.tenant.findUnique({ where: { slug: input.tenantSlug } });
    if (!tenant || !tenant.isActive) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid tenant." });
    }

    // PINs are bcrypt hashes now, so they cannot be matched with a WHERE clause.
    // Candidates are scoped to one tenant's active staff (a handful of rows), so
    // comparing sequentially stays well inside POS latency budgets.
    const candidates = await ctx.db.user.findMany({
      where: { tenantId: tenant.id, isActive: true, pinHash: { not: null } },
      orderBy: { createdAt: "asc" },
    });

    let matched: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      if (!candidate.pinHash) continue;
      if (await verifyPin(input.pin, candidate.pinHash)) {
        matched = candidate;
        break;
      }
    }
    if (!matched) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid PIN." });
    }

    const session = await startSession({
      userId: matched.id,
      tenantId: matched.tenantId,
      role: matched.role as Role,
    });

    return {
      token: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.accessTtlSeconds,
      refreshExpiresIn: session.refreshTtlSeconds,
      user: toSafeUser(matched),
    };
  }),

  /**
   * Exchange a refresh token for a fresh pair. The refresh token is rotated and
   * replaying a stale one revokes the whole session (see SessionManager.rotate).
   *
   * Public rather than protected: the access token is expected to be expired at
   * this point. It still passes through the tighter auth-attempt rate limit.
   */
  refresh: authProcedure.input(refreshSchema).mutation(async ({ input }) => {
    let session;
    try {
      session = await refreshSession(input.refreshToken);
    } catch {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session." });
    }

    return {
      token: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.accessTtlSeconds,
      refreshExpiresIn: session.refreshTtlSeconds,
    };
  }),

  /** Revoke the current session in Redis. Idempotent. */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const sessionId = ctx.auth.sessionId;
    if (sessionId) {
      await getAuthService().sessions.revoke(sessionId);
    }
    return { success: true };
  }),

  me: protectedProcedure.query(({ ctx }) => {
    return {
      user: toSafeUser(ctx.auth.user),
      tenant: { id: ctx.auth.tenant.id, name: ctx.auth.tenant.name, slug: ctx.auth.tenant.slug },
    };
  }),
});
