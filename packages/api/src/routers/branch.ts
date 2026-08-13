// Branch router.
//
// Operational queries (tables, orders, KOTs, reports) are all branch-scoped,
// but the authenticated principal only carries a tenantId. This router lets a
// client discover the branches it may act on without guessing IDs.
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { idSchema } from "../schemas/common.js";
import { protectedProcedure, router } from "../trpc.js";

export const branchRouter = router({
  /** All active branches for the caller's tenant, oldest first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.branch.findMany({
      where: { tenantId: ctx.auth.tenant.id, isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }),

  /** A single branch, scoped to the caller's tenant. */
  get: protectedProcedure
    .input(z.object({ id: idSchema }).strict())
    .query(async ({ ctx, input }) => {
      const branch = await ctx.db.branch.findFirst({
        where: { id: input.id, tenantId: ctx.auth.tenant.id },
      });
      if (!branch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." });
      }
      return branch;
    }),
});
