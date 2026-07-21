// Order router: create with totals, add items, list, status transitions, cancel.
import { TRPCError } from "@trpc/server";
import { Prisma } from "@zerosky/database";
import type { PrismaClient } from "@zerosky/database";
import {
  addItemsSchema,
  cancelOrderSchema,
  createOrderSchema,
  getOrderSchema,
  listOrdersSchema,
  orderLineSchema,
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
  lineNet: Prisma.Decimal;
  lineTax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  seat?: number;
  notes?: string;
}

/** Load items (scoped to the tenant) and compute per-line + order totals. */
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
    const qty = new Prisma.Decimal(line.quantity);
    const lineNet = item.price.mul(qty);
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
      lineNet,
      lineTax,
      lineTotal,
      ...(line.seat !== undefined ? { seat: line.seat } : {}),
      ...(line.notes !== undefined ? { notes: line.notes } : {}),
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

      return ctx.db.order.create({
        data: {
          branchId: branch.id,
          tableId: input.tableId,
          createdById: ctx.auth.user.id,
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
              lineTotal: p.lineTotal,
              seat: p.seat,
              notes: p.notes,
            })),
          },
        },
        include: { items: true },
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
              lineTotal: p.lineTotal,
              seat: p.seat,
              notes: p.notes,
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
      include: { items: true, payments: true, kots: true },
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
      return ctx.db.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          notes: input.reason ?? order.notes,
        },
      });
    }),
});
