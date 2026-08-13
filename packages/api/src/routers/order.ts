// Order router: create with totals, add items, list, status transitions, cancel.
import { TRPCError } from "@trpc/server";
import { resolveOpenShift } from "./shift.js";
import { Prisma } from "@zerosky/database";
import type { PrismaClient } from "@zerosky/database";
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
import { z } from "zod";

type Line = z.infer<typeof orderLineSchema>;

interface PricedLine {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  /** Rupees taken off this line before GST. Stored on OrderItem.discountAmount. */
  discountAmount: Prisma.Decimal;
  lineNet: Prisma.Decimal;
  lineTax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  seat?: number;
  notes?: string;
  modifiers?: Array<{ name: string; price: number }>;
}

/**
 * Load items (scoped to the tenant) and compute per-line + order totals.
 *
 * TAX ORDERING (line level): Indian GST is charged on the value actually paid,
 * so a line discount must shrink the taxable base rather than be knocked off
 * after tax. The order of operations per line is therefore:
 *
 *   grossLine   = (unit price + modifier deltas) × qty
 *   lineNet     = grossLine − discountAmount        // taxable base
 *   lineTax     = lineNet × taxRate / 100           // GST on the DISCOUNTED base
 *   lineTotal   = lineNet + lineTax
 *
 * `subtotal` sums the net (post-discount) line values, and `taxTotal` sums the
 * tax computed on those net values — never on the gross. An order-level
 * discount is layered on top of this in applyDiscount(), which re-derives tax
 * on the further-reduced base for the same reason.
 */
async function priceLines(
  db: PrismaClient,
  tenantId: string,
  lines: Line[],
): Promise<{
  priced: PricedLine[];
  subtotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}> {
  const ids = [...new Set(lines.map((l) => l.itemId))];
  const items = await db.item.findMany({
    where: { id: { in: ids }, category: { menu: { tenantId } } },
  });
  const byId = new Map(items.map((i) => [i.id, i]));

  let subtotal = new Prisma.Decimal(0);
  let taxTotal = new Prisma.Decimal(0);
  const priced: PricedLine[] = [];

  for (const line of lines) {
    const item = byId.get(line.itemId);
    if (!item) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Item ${line.itemId} not found for tenant.`,
      });
    }
    
    // Calculate modifier deltas
    let modifierDelta = new Prisma.Decimal(0);
    const modifierSnapshot: Array<{ name: string; price: number }> = [];
    
    if (line.modifiers) {
      for (const group of line.modifiers) {
        for (const option of group.options) {
          modifierDelta = modifierDelta.add(option.price);
          modifierSnapshot.push({ name: option.name, price: option.price });
        }
      }
    }
    
    // Unit price includes base item + modifiers
    const unitPriceWithModifiers = item.price.add(modifierDelta);
    const qty = new Prisma.Decimal(line.quantity);
    const grossLine = unitPriceWithModifiers.mul(qty);

    // Line-level discount reduces the taxable base. It is a whole-line rupee
    // amount and must never exceed the gross line value (which would push the
    // net — and therefore the GST base — negative).
    const lineDiscount = new Prisma.Decimal(line.discountAmount ?? 0);
    if (lineDiscount.greaterThan(grossLine)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Line discount ₹${lineDiscount.toString()} exceeds line total ₹${grossLine.toString()}.`,
      });
    }

    const lineNet = grossLine.sub(lineDiscount);
    const lineTax = lineNet.mul(item.taxRate).div(100);
    const lineTotal = lineNet.add(lineTax);
    
    subtotal = subtotal.add(lineNet);
    taxTotal = taxTotal.add(lineTax);
    
    priced.push({
      itemId: item.id,
      name: item.name,
      quantity: line.quantity,
      unitPrice: item.price,
      taxRate: item.taxRate,
      discountAmount: lineDiscount,
      lineNet,
      lineTax,
      lineTotal,
      ...(line.seat !== undefined ? { seat: line.seat } : {}),
      ...(line.notes !== undefined ? { notes: line.notes } : {}),
      ...(modifierSnapshot.length > 0 ? { modifiers: modifierSnapshot } : {}),
    });
  }

  return { priced, subtotal, taxTotal, grandTotal: subtotal.add(taxTotal) };
}

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
      const { priced, subtotal, taxTotal, grandTotal } = await priceLines(
        ctx.db,
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
      const { priced, subtotal, taxTotal, grandTotal } = await priceLines(
        ctx.db,
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
      return ctx.db.order.findMany({
        where: {
          branchId: input.branchId,
          branch: { tenantId: ctx.auth.tenant.id },
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { items: true },
      });
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

  setStatus: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN")
    .input(setOrderStatusSchema)
    .mutation(async ({ ctx, input }) => {
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

      // Reconstruct the pre-discount taxable net for every line so tax can be
      // recomputed on the reduced base rather than trusting the stored tax.
      const lines = order.items.map((it) => {
        const modifierDelta = Array.isArray(it.modifiers)
          ? (it.modifiers as Array<{ price?: number }>).reduce(
              (sum, m) => sum.add(new Prisma.Decimal(m?.price ?? 0)),
              new Prisma.Decimal(0),
            )
          : new Prisma.Decimal(0);
        const gross = it.unitPrice.add(modifierDelta).mul(it.quantity);
        const lineNet = gross.sub(it.discountAmount);
        return { lineNet, taxRate: it.taxRate };
      });

      const subtotal = lines.reduce(
        (sum, l) => sum.add(l.lineNet),
        new Prisma.Decimal(0),
      );

      // Resolve the operator's intent to a concrete rupee amount.
      const value = new Prisma.Decimal(input.value);
      let discountTotal =
        input.type === "PERCENT"
          ? subtotal.mul(value).div(100)
          : value;
      discountTotal = discountTotal.toDecimalPlaces(2);

      if (discountTotal.greaterThan(subtotal)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Discount ₹${discountTotal.toString()} exceeds the order subtotal ₹${subtotal.toString()}.`,
        });
      }

      // GST on the reduced base: shrink every line's taxable value by the same
      // factor, then recompute tax per line so mixed tax rates stay correct.
      const factor = subtotal.isZero()
        ? new Prisma.Decimal(0)
        : subtotal.sub(discountTotal).div(subtotal);
      const taxTotal = lines
        .reduce(
          (sum, l) =>
            sum.add(l.lineNet.mul(factor).mul(l.taxRate).div(100)),
          new Prisma.Decimal(0),
        )
        .toDecimalPlaces(2);

      const grandTotal = subtotal.sub(discountTotal).add(taxTotal);

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
