// Table router: create/list/update per branch, state transitions (waiter+).
import { TRPCError } from "@trpc/server";
import { Prisma } from "@zerosky/database";
import {
  createTableSchema,
  listTablesSchema,
  setTableStateSchema,
  transferOrderSchema,
  mergeOrdersSchema,
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

  transferOrder: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER")
    .input(transferOrderSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate the order belongs to the tenant and is seated at fromTable
      const order = await ctx.db.order.findFirst({
        where: {
          id: input.orderId,
          tableId: input.fromTableId,
          branch: { tenantId: ctx.auth.tenant.id },
        },
      });
      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found or not seated at source table.",
        });
      }
      if (order.status === "PAID" || order.status === "CANCELLED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transfer a ${order.status} order.`,
        });
      }

      // Validate both tables belong to the caller's branch
      const [fromTable, toTable] = await Promise.all([
        ctx.db.table.findFirst({
          where: {
            id: input.fromTableId,
            branch: { tenantId: ctx.auth.tenant.id },
          },
        }),
        ctx.db.table.findFirst({
          where: {
            id: input.toTableId,
            branch: { tenantId: ctx.auth.tenant.id },
          },
        }),
      ]);
      if (!fromTable || !toTable) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or both tables not found.",
        });
      }
      if (fromTable.branchId !== toTable.branchId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot transfer between branches.",
        });
      }

      // Reject if destination already has a live order
      const destOrder = await ctx.db.order.findFirst({
        where: {
          tableId: input.toTableId,
          status: { notIn: ["PAID", "CANCELLED"] },
        },
      });
      if (destOrder) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Destination table already has a live order.",
        });
      }

      return ctx.db.$transaction(async (tx) => {
        // Move the order
        await tx.order.update({
          where: { id: order.id },
          data: { tableId: input.toTableId },
        });

        // Mark destination occupied
        await tx.table.update({
          where: { id: input.toTableId },
          data: { state: "OCCUPIED" },
        });

        // Release source only if no other live order still holds it
        const stillBusy = await tx.order.count({
          where: {
            tableId: input.fromTableId,
            status: { notIn: ["PAID", "CANCELLED"] },
          },
        });
        if (stillBusy === 0) {
          await tx.table.update({
            where: { id: input.fromTableId },
            data: { state: "AVAILABLE" },
          });
        }

        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { items: true, table: true },
        });
      });
    }),

  mergeOrders: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER")
    .input(mergeOrdersSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate all orders belong to the tenant
      const orders = await ctx.db.order.findMany({
        where: {
          id: { in: input.orderIds },
          branch: { tenantId: ctx.auth.tenant.id },
        },
        include: { items: true },
      });
      if (orders.length !== input.orderIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more orders not found.",
        });
      }

      // Validate primary order is in the list
      const primary = orders.find((o) => o.id === input.primaryOrderId);
      if (!primary) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Primary order must be one of the orders to merge.",
        });
      }

      // Reject if orders are from different branches
      const branches = new Set(orders.map((o) => o.branchId));
      if (branches.size > 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot merge orders from different branches.",
        });
      }

      // Reject if any order is PAID or CANCELLED
      const invalid = orders.find(
        (o) => o.status === "PAID" || o.status === "CANCELLED"
      );
      if (invalid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot merge a ${invalid.status} order.`,
        });
      }

      const otherOrders = orders.filter((o) => o.id !== input.primaryOrderId);
      const vacatedTableIds = new Set(
        otherOrders.map((o) => o.tableId).filter((id): id is string => id !== null)
      );

      return ctx.db.$transaction(async (tx) => {
        // Move all items from other orders to the primary order
        for (const other of otherOrders) {
          await tx.orderItem.updateMany({
            where: { orderId: other.id },
            data: { orderId: primary.id },
          });
        }

        // Recompute primary order totals from all its lines
        const allItems = await tx.orderItem.findMany({
          where: { orderId: primary.id },
        });

        let subtotal = new Prisma.Decimal(0);
        let taxTotal = new Prisma.Decimal(0);
        for (const item of allItems) {
          const lineNet = item.unitPrice
            .mul(item.quantity)
            .minus(item.discountAmount);
          const lineTax = lineNet.mul(item.taxRate).div(100);
          subtotal = subtotal.add(lineNet);
          taxTotal = taxTotal.add(lineTax);
        }
        const grandTotal = subtotal.add(taxTotal).minus(primary.discountTotal);

        await tx.order.update({
          where: { id: primary.id },
          data: { subtotal, taxTotal, grandTotal },
        });

        // Cancel the emptied orders
        await tx.order.updateMany({
          where: { id: { in: otherOrders.map((o) => o.id) } },
          data: { status: "CANCELLED" },
        });

        // Release vacated tables
        for (const tableId of vacatedTableIds) {
          const stillBusy = await tx.order.count({
            where: {
              tableId,
              status: { notIn: ["PAID", "CANCELLED"] },
            },
          });
          if (stillBusy === 0) {
            await tx.table.update({
              where: { id: tableId },
              data: { state: "AVAILABLE" },
            });
          }
        }

        return tx.order.findUniqueOrThrow({
          where: { id: primary.id },
          include: { items: true, table: true },
        });
      });
    }),
});
