// Table router: create/list/update per branch, state transitions (waiter+).
import { TRPCError } from "@trpc/server";
import {
  createTableSchema,
  listTablesSchema,
  setTableStateSchema,
  updateTableSchema,
} from "../schemas/table.js";
import { protectedProcedure, roleProcedure, router } from "../trpc.js";

async function assertBranch(
  ctx: { db: import("@zerosky/database").PrismaClient; auth: { tenant: { id: string } } },
  branchId: string,
) {
  const branch = await ctx.db.branch.findFirst({
    where: { id: branchId, tenantId: ctx.auth.tenant.id },
  });
  if (!branch) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." });
  }
  return branch;
}

export const tableRouter = router({
  list: protectedProcedure
    .input(listTablesSchema)
    .query(async ({ ctx, input }) => {
      await assertBranch(ctx, input.branchId);
      return ctx.db.table.findMany({
        where: { branchId: input.branchId },
        orderBy: { name: "asc" },
      });
    }),

  create: roleProcedure("OWNER", "MANAGER")
    .input(createTableSchema)
    .mutation(async ({ ctx, input }) => {
      await assertBranch(ctx, input.branchId);
      return ctx.db.table.create({
        data: {
          branchId: input.branchId,
          name: input.name,
          section: input.section,
          seats: input.seats,
        },
      });
    }),

  update: roleProcedure("OWNER", "MANAGER")
    .input(updateTableSchema)
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.id, branch: { tenantId: ctx.auth.tenant.id } },
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found." });
      }
      return ctx.db.table.update({
        where: { id: table.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.section !== undefined ? { section: input.section } : {}),
          ...(input.seats !== undefined ? { seats: input.seats } : {}),
        },
      });
    }),

  setState: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER")
    .input(setTableStateSchema)
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.findFirst({
        where: { id: input.id, branch: { tenantId: ctx.auth.tenant.id } },
      });
      if (!table) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Table not found." });
      }
      return ctx.db.table.update({
        where: { id: table.id },
        data: { state: input.state },
      });
    }),
});
