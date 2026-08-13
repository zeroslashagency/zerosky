// Payment router: record against order, list, refund (captured-only), status.
import { TRPCError } from "@trpc/server";
import { resolveOpenShift } from "./shift.js";
import { Prisma } from "@zerosky/database";
import {
  listPaymentsSchema,
  recordPaymentSchema,
  refundPaymentSchema,
  setPaymentStatusSchema,
  splitBillSchema,
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
      return ctx.db.$transaction(async (tx) => {
        // Attribute the tender to the open till. This is what makes shift
        // reconciliation meaningful: closing a shift sums the CASH payments
        // carrying its shiftId to work out what should be in the drawer.
        // Null when no till is open, so billing still works either way.
        const openShift = await resolveOpenShift(tx, order.branchId);

        const payment = await tx.payment.create({
          data: {
            branchId: order.branchId,
            orderId: order.id,
            shiftId: openShift?.id ?? null,
            method: input.method,
            status: input.status,
            amount: new Prisma.Decimal(input.amount),
            reference: input.reference,
          },
        });

        // Settle the order once captured payments cover the grand total.
        // Recording a payment used to leave the order in its previous state,
        // so a fully-paid order never reached PAID and its revenue was
        // invisible to reports (salesSummary only counts PAID orders).
        const captured = await tx.payment.aggregate({
          where: { orderId: order.id, status: "CAPTURED" },
          _sum: { amount: true },
        });
        const paid = captured._sum.amount ?? new Prisma.Decimal(0);

        if (order.status !== "PAID" && paid.gte(order.grandTotal)) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: "PAID" },
          });
          // Free the table so the floor plan reflects reality.
          if (order.tableId) {
            await tx.table.update({
              where: { id: order.tableId },
              data: { state: "AVAILABLE" },
            });
          }
        }

        return payment;
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

  splitBill: roleProcedure("OWNER", "MANAGER", "CASHIER")
    .input(splitBillSchema)
    .query(async ({ ctx, input }) => {
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, branch: { tenantId: ctx.auth.tenant.id } },
        include: { items: true },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      if (order.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot split a cancelled order.",
        });
      }

      const grandTotalPaise = order.grandTotal.mul(100).toNumber();

      if (input.method.type === "amount") {
        // Amount-based split: validate parts sum exactly to grandTotal
        const partsPaise = input.method.parts.map((p) =>
          new Prisma.Decimal(p).mul(100).toNumber()
        );
        const sumPaise = partsPaise.reduce((a, b) => a + b, 0);

        if (sumPaise !== grandTotalPaise) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Split parts total ₹${(sumPaise / 100).toFixed(2)} does not match grand total ₹${order.grandTotal.toFixed(2)}`,
          });
        }

        return {
          parts: input.method.parts.map((amount, index) => ({
            index: index + 1,
            amount: Number(amount),
            items: [], // Amount splits don't break down by item
          })),
        };
      } else {
        // Seat-based split: group items by seat and compute each part's total
        const seatMap = new Map<number, typeof order.items>();
        for (const item of order.items) {
          const seat = item.seat ?? 0; // null/undefined → seat 0
          const group = seatMap.get(seat) ?? [];
          group.push(item);
          seatMap.set(seat, group);
        }

        const parts: Array<{ seat: number; amount: number; items: string[] }> = [];
        let accumulatedPaise = 0;

        const seats = Array.from(seatMap.keys()).sort((a, b) => a - b);
        for (let i = 0; i < seats.length; i++) {
          const seat = seats[i];
          if (seat === undefined) continue;
          const items = seatMap.get(seat);
          if (!items) continue;

          let seatSubtotal = new Prisma.Decimal(0);
          let seatTax = new Prisma.Decimal(0);

          for (const item of items) {
            const lineNet = item.unitPrice
              .mul(item.quantity)
              .minus(item.discountAmount);
            const lineTax = lineNet.mul(item.taxRate).div(100);
            seatSubtotal = seatSubtotal.add(lineNet);
            seatTax = seatTax.add(lineTax);
          }

          const seatTotal = seatSubtotal.add(seatTax);
          let seatPaise = seatTotal.mul(100).toNumber();

          // On the last seat, assign any residual to ensure exact sum
          if (i === seats.length - 1) {
            seatPaise = grandTotalPaise - accumulatedPaise;
          }

          accumulatedPaise += seatPaise;

          parts.push({
            seat: seat ?? 0,
            amount: seatPaise / 100,
            items: items.map((it) => it.name),
          });
        }

        // Verify the split is exact
        if (accumulatedPaise !== grandTotalPaise) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Seat split does not sum to grand total.",
          });
        }

        return { parts };
      }
    }),
});
