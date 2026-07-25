// Auth router.
import { TRPCError } from "@trpc/server";
import { verifyPassword } from "@zerosky/auth";
import { loginSchema, pinLoginSchema } from "../schemas/auth.js";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";

function toSafeUser(user: { id: string; email: string; name: string; role: string; tenantId: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId };
}

export const authRouter = router({
  login: publicProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
    const tenant = await ctx.db.tenant.findUnique({ where: { slug: input.tenantSlug } });
    if (!tenant || !tenant.isActive) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid tenant." });
    }
    const user = await ctx.db.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
    });
    if (!user || !user.isActive) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials." });
    }
    // Verify the supplied password against the stored bcrypt hash. Without this
    // check any password would authenticate the account.
    const passwordOk = await verifyPassword(input.password, user.passwordHash);
    if (!passwordOk) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials." });
    }
    return { token: user.id, user: toSafeUser(user) };
  }),

  pinLogin: publicProcedure.input(pinLoginSchema).mutation(async ({ ctx, input }) => {
    const tenant = await ctx.db.tenant.findUnique({ where: { slug: input.tenantSlug } });
    if (!tenant || !tenant.isActive) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid tenant." });
    }
    const user = await ctx.db.user.findFirst({
      where: { tenantId: tenant.id, pin: input.pin, isActive: true },
    });
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid PIN." });
    }
    return { token: user.id, user: toSafeUser(user) };
  }),

  me: protectedProcedure.query(({ ctx }) => {
    return {
      user: toSafeUser(ctx.auth.user),
      tenant: { id: ctx.auth.tenant.id, name: ctx.auth.tenant.name, slug: ctx.auth.tenant.slug },
    };
  }),
});
