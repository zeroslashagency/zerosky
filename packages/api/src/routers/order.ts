// Order router: create with totals, add items, list, status transitions, cancel.
import { TRPCError } from "@trpc/server";
import { resolveOpenShift } from "./shift.js";
import { Prisma } from "@zerosky/database";
import { getOrderRepo, getPricing } from "../context.js";
import { PricingService } from "../core/services/pricing.js";
import {
  addItemsSchema,
  applyDiscountSchema,
  cancelOrderSchema,
  createOrderSchema,
  getOrderSchema,
  listOrdersSchema,
  orderLineSchema,
  removeDiscountSchema,
  setOrderStatusSchema,
} from "../schemas/order.js";
import { protectedProcedure, roleProcedure, router } from "../trpc.js";

function nextOrderNumber(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

export const orderRouter = router({
  create: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER")
    .input(createOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const branch = await ctx.db.branch.findFirst({
        where: { id: input.branchId, tenantId: ctx.auth.tenant.id },
      });
      if (!branch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." });
      }
      const { priced, subtotal, taxTotal, grandTotal } = await getPricing(ctx).priceLines(
        ctx.auth.tenant.id,
        input.items,
      );

      // Seating a dine-in order has to occupy the table, otherwise the floor
      // plan keeps showing it free and a second party can be seated on top of
      // a live order.
      if (input.tableId) {
        const table = await ctx.db.table.findFirst({
          where: { id: input.tableId, branchId: branch.id },
        });
        if (!table) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Table not found." });
        }
      }

      return ctx.db.$transaction(async (tx) => {
        // Attribute the order to the open till so shift reconciliation can see
        // it. Deliberately not a hard gate: a branch that never opened a shift
        // still bills normally, the order just falls outside till reporting.
        const openShift = await resolveOpenShift(tx, branch.id);

        if (input.tableId) {
          await tx.table.update({
            where: { id: input.tableId },
            data: { state: "OCCUPIED" },
          });
        }

        return tx.order.create({
          data: {
            branchId: branch.id,
            tableId: input.tableId,
            createdById: ctx.auth.user.id,
            shiftId: openShift?.id ?? null,
            orderNumber: nextOrderNumber(),
            type: input.type,
            guestCount: input.guestCount,
            notes: input.notes,
            subtotal,
            taxTotal,
            grandTotal,
            items: {
              create: priced.map((p) => ({
                itemId: p.itemId,
                name: p.name,
                quantity: p.quantity,
                unitPrice: p.unitPrice,
                taxRate: p.taxRate,
                discountAmount: p.discountAmount,
                lineTotal: p.lineTotal,
                seat: p.seat,
                notes: p.notes,
                modifiers: p.modifiers ? p.modifiers : undefined,
              })),
            },
          },
          include: { items: true },
        });
      });
    }),

  addItems: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER")
    .input(addItemsSchema)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, branch: { tenantId: ctx.auth.tenant.id } },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      if (order.status === "PAID" || order.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot modify a ${order.status} order.`,
        });
      }
      const { priced, subtotal, taxTotal, grandTotal } = await getPricing(ctx).priceLines(
        ctx.auth.tenant.id,
        input.items,
      );

      return ctx.db.order.update({
        where: { id: order.id },
        data: {
          subtotal: order.subtotal.add(subtotal),
          taxTotal: order.taxTotal.add(taxTotal),
          grandTotal: order.grandTotal.add(grandTotal),
          items: {
            create: priced.map((p) => ({
              itemId: p.itemId,
              name: p.name,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              taxRate: p.taxRate,
              discountAmount: p.discountAmount,
              lineTotal: p.lineTotal,
              seat: p.seat,
              notes: p.notes,
              modifiers: p.modifiers ? p.modifiers : undefined,
            })),
          },
        },
        include: { items: true },
      });
    }),

  list: protectedProcedure
    .input(listOrdersSchema)
    .query(async ({ ctx, input }) => {
      const filter = input.statuses ?? input.status ?? undefined;
      // Delegates to IOrderRepository — lean select + _count, no OrderItem rows.
      return getOrderRepo(ctx).listLean(input.branchId, ctx.auth.tenant.id, filter as never, input.limit);
    }),

  get: protectedProcedure.input(getOrderSchema).query(async ({ ctx, input }) => {
    const order = await ctx.db.order.findFirst({
      where: { id: input.id, branch: { tenantId: ctx.auth.tenant.id } },
      // The table relation is needed so screens can show a human table name
      // ("T2") rather than leaking the raw cuid onto the printed bill.
      include: { items: true, payments: true, kots: true, table: true },
    });
    if (!order) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
    }
    return order;
  }),

  setStatus: protectedProcedure
    .input(setOrderStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const privileged = ["PAID", "CANCELLED"] as const;
      if ((privileged as readonly string[]).includes(input.status) && ctx.auth.user.role === "KITCHEN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "KITCHEN cannot set status to PAID or CANCELLED." });
      }
      const allowedByRole: Record<string, readonly string[]> = {
        OWNER: ["OPEN", "SENT_TO_KITCHEN", "READY", "SERVED", "BILLED", "PAID", "CANCELLED"],
        MANAGER: ["OPEN", "SENT_TO_KITCHEN", "READY", "SERVED", "BILLED", "PAID", "CANCELLED"],
        CASHIER: ["BILLED", "PAID", "CANCELLED"],
        WAITER: ["OPEN", "SENT_TO_KITCHEN", "READY", "SERVED"],
        KITCHEN: ["SENT_TO_KITCHEN", "READY", "SERVED"],
      };
      const allowed = allowedByRole[ctx.auth.user.role];
      if (allowed && !allowed.includes(input.status)) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Role ${ctx.auth.user.role} cannot set status to ${input.status}.` });
      }
      const order = await ctx.db.order.findFirst({
        where: { id: input.id, branch: { tenantId: ctx.auth.tenant.id } },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      if (order.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change status of a cancelled order.",
        });
      }
      return ctx.db.order.update({
        where: { id: order.id },
        data: { status: input.status },
      });
    }),

  cancel: roleProcedure("OWNER", "MANAGER")
    .input(cancelOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.findFirst({
        where: { id: input.id, branch: { tenantId: ctx.auth.tenant.id } },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      if (order.status === "PAID") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot cancel a paid order.",
        });
      }
      return ctx.db.$transaction(async (tx) => {
        const cancelled = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
            notes: input.reason ?? order.notes,
          },
        });

        // Release the table unless another live order still occupies it.
        // Cancelling used to leave the table OCCUPIED forever, so the floor
        // plan slowly filled up with tables nobody was sitting at.
        if (order.tableId) {
          const stillBusy = await tx.order.count({
            where: {
              tableId: order.tableId,
              status: { notIn: ["PAID", "CANCELLED"] },
            },
          });
          if (stillBusy === 0) {
            await tx.table.update({
              where: { id: order.tableId },
              data: { state: "AVAILABLE" },
            });
          }
        }

        return cancelled;
      });
    }),

  // ───────────────────────────────────────────────────────────
  // Discounts
  //
  // TAX ORDERING (order level) — the decision that matters here:
  // Indian GST is levied on the *discounted* consideration, so an order-level
  // discount reduces the taxable base BEFORE tax is charged; it is never
  // subtracted after tax. Concretely, for a persisted order we:
  //   1. reconstruct each line's taxable net = (unitPrice + modifiers)×qty − lineDiscount
  //   2. subtotal            = Σ lineNet                      (pre-discount base)
  //   3. discountTotal       = PERCENT → subtotal×value/100 | FLAT → value
  //   4. factor              = (subtotal − discountTotal) / subtotal
  //   5. per line, taxable   = lineNet × factor, lineTax = taxable × rate/100
  //   6. taxTotal            = Σ lineTax   (GST on the REDUCED base)
  //   7. grandTotal          = subtotal − discountTotal + taxTotal
  //
  // Worked example — 4 items @ ₹100, 5% GST, 10% order discount:
  //   subtotal = 400, discountTotal = 40, reduced base = 360,
  //   taxTotal = 360 × 5% = 18, grandTotal = 400 − 40 + 18 = 378.
  // Charging tax first (20) then discounting after (420 − 40 = 380) would
  // over-collect ₹2 of GST on money the customer never paid — the wrong order.
  // ───────────────────────────────────────────────────────────
  applyDiscount: roleProcedure("OWNER", "MANAGER", "CASHIER")
    .input(applyDiscountSchema)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, branch: { tenantId: ctx.auth.tenant.id } },
        include: { items: true },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      if (order.status === "PAID" || order.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot discount a ${order.status} order.`,
        });
      }

      const lines = order.items.map((it) => {
        const modifierDelta = Array.isArray(it.modifiers)
          ? (it.modifiers as Array<{ price?: number }>).reduce(
              (s, m) => s.add(new Prisma.Decimal(m?.price ?? 0)),
              new Prisma.Decimal(0),
            )
          : new Prisma.Decimal(0);
        const lineNet = it.unitPrice.add(modifierDelta).mul(it.quantity).sub(it.discountAmount);
        return { lineNet, taxRate: it.taxRate };
      });
      // Core service — single source for the reduced-base GST math.
      const { subtotal, discountTotal, taxTotal, grandTotal } = PricingService.discountTotals({
        lines,
        value: input.value,
        type: input.type,
      });
      const value = new Prisma.Decimal(input.value);

      return ctx.db.order.update({
        where: { id: order.id },
        data: {
          subtotal,
          taxTotal,
          discountTotal,
          discountType: input.type,
          discountValue: value,
          discountReason: input.reason,
          discountById: ctx.auth.user.id,
          grandTotal,
        },
        include: { items: true },
      });
    }),

  removeDiscount: roleProcedure("OWNER", "MANAGER", "CASHIER")
    .input(removeDiscountSchema)
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.order.findFirst({
        where: { id: input.orderId, branch: { tenantId: ctx.auth.tenant.id } },
        include: { items: true },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found." });
      }
      if (order.status === "PAID" || order.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot modify a ${order.status} order.`,
        });
      }

      // Recompute totals with no order-level discount: tax returns to the full
      // (line-net) base. Line-level discounts on items are preserved.
      let subtotal = new Prisma.Decimal(0);
      let taxTotal = new Prisma.Decimal(0);
      for (const it of order.items) {
        const modifierDelta = Array.isArray(it.modifiers)
          ? (it.modifiers as Array<{ price?: number }>).reduce(
              (sum, m) => sum.add(new Prisma.Decimal(m?.price ?? 0)),
              new Prisma.Decimal(0),
            )
          : new Prisma.Decimal(0);
        const gross = it.unitPrice.add(modifierDelta).mul(it.quantity);
        const lineNet = gross.sub(it.discountAmount);
        subtotal = subtotal.add(lineNet);
        taxTotal = taxTotal.add(lineNet.mul(it.taxRate).div(100));
      }
      taxTotal = taxTotal.toDecimalPlaces(2);

      return ctx.db.order.update({
        where: { id: order.id },
        data: {
          subtotal,
          taxTotal,
          discountTotal: new Prisma.Decimal(0),
          discountType: null,
          discountValue: null,
          discountReason: null,
          discountById: null,
          grandTotal: subtotal.add(taxTotal),
        },
        include: { items: true },
      });
    }),
});
