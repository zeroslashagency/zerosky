// Payment router: record against order, list, refund (captured-only), status.
import { TRPCError } from "@trpc/server";
import { Prisma } from "@zerosky/database";
import {
  listPaymentsSchema,
  recordPaymentSchema,
  refundPaymentSchema,
  setPaymentStatusSchema,
} from "../schemas/payment.js";
import { protectedProcedure, roleProcedure, router } from "../trpc.js";

export const paymentRouter = router({
  record: roleProcedure("OWNER", "MANAGER", "CASHIER")
    .input(recordPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, branch: { tenantId: ctx.auth.tenant.id } },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      if (order.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot record payment on a cancelled order.",
        });
      }
      return ctx.db.payment.create({
        data: {
          branchId: order.branchId,
          orderId: order.id,
          method: input.method,
          status: input.status,
          amount: new Prisma.Decimal(input.amount),
          reference: input.reference,
        },
      });
    }),

  list: protectedProcedure
    .input(listPaymentsSchema)
    .query(async ({ ctx, input }) => {
      return ctx.db.payment.findMany({
        where: {
          branch: { tenantId: ctx.auth.tenant.id },
          ...(input.branchId ? { branchId: input.branchId } : {}),
          ...(input.orderId ? { orderId: input.orderId } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  refund: roleProcedure("OWNER", "MANAGER")
    .input(refundPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.payment.findFirst({
        where: {
          id: input.id,
          branch: { tenantId: ctx.auth.tenant.id },
        },
      });
      if (!payment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found." });
      }
      if (payment.status !== "CAPTURED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only captured payments can be refunded.",
        });
      }
      return ctx.db.payment.update({
        where: { id: payment.id },
        data: {
          status: "REFUNDED",
          reference: input.reference ?? payment.reference,
        },
      });
    }),

  setStatus: roleProcedure("OWNER", "MANAGER")
    .input(setPaymentStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.payment.findFirst({
        where: { id: input.id, branch: { tenantId: ctx.auth.tenant.id } },
      });
      if (!payment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found." });
      }
      return ctx.db.payment.update({
        where: { id: payment.id },
        data: { status: input.status },
      });
    }),
});
