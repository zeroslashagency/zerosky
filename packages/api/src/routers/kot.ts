// KOT router: generate from pending order items, list, status, markPrinted.
import { TRPCError } from "@trpc/server";
import {
  generateKotSchema,
  listKotsSchema,
  markKotPrintedSchema,
  setKotStatusSchema,
} from "../schemas/kot.js";
import { protectedProcedure, roleProcedure, router } from "../trpc.js";

function nextKotNumber(): string {
  return `KOT-${Date.now().toString(36).toUpperCase()}`;
}

export const kotRouter = router({
  generate: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER")
    .input(generateKotSchema)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, branch: { tenantId: ctx.auth.tenant.id } },
        include: { items: true },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      const pending = order.items.filter(
        (i) => i.kotId === null && i.status === "PENDING",
      );
      if (pending.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No pending items to send to kitchen.",
        });
      }

      const kot = await ctx.db.kot.create({
        data: {
          orderId: order.id,
          kotNumber: nextKotNumber(),
          station: input.station,
          status: "NEW",
          items: {
            connect: pending.map((i) => ({ id: i.id })),
          },
        },
        include: { items: true },
      });

      await ctx.db.orderItem.updateMany({
        where: { id: { in: pending.map((i) => i.id) } },
        data: { status: "PREPARING" },
      });

      if (order.status === "OPEN") {
        await ctx.db.order.update({
          where: { id: order.id },
          data: { status: "SENT_TO_KITCHEN" },
        });
      }

      return kot;
    }),

  list: protectedProcedure.input(listKotsSchema).query(async ({ ctx, input }) => {
    return ctx.db.kot.findMany({
      where: {
        order: {
          branch: { tenantId: ctx.auth.tenant.id },
          ...(input.branchId ? { branchId: input.branchId } : {}),
        },
        ...(input.orderId ? { orderId: input.orderId } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: { items: true, order: { include: { table: true } } },
    });
  }),

  setStatus: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN")
    .input(setKotStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const kot = await ctx.db.kot.findFirst({
        where: {
          id: input.id,
          order: { branch: { tenantId: ctx.auth.tenant.id } },
        },
      });
      if (!kot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "KOT not found." });
      }
      return ctx.db.kot.update({
        where: { id: kot.id },
        data: { status: input.status },
      });
    }),

  markPrinted: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN")
    .input(markKotPrintedSchema)
    .mutation(async ({ ctx, input }) => {
      const kot = await ctx.db.kot.findFirst({
        where: {
          id: input.id,
          order: { branch: { tenantId: ctx.auth.tenant.id } },
        },
      });
      if (!kot) {
        throw new TRPCError({ code: "NOT_FOUND", message: "KOT not found." });
      }
      return ctx.db.kot.update({
        where: { id: kot.id },
        data: { printedAt: new Date() },
      });
    }),
});
