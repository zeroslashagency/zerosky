import { z } from 'zod';
import { Prisma } from '@zerosky/database';
import { router, protectedProcedure, roleProcedure } from '../trpc.js';

const managerReportsProcedure = roleProcedure('OWNER', 'MANAGER');

export const reportsRouter = router({
  // Sales summary - OPTIMIZED: aggregate in PostgreSQL instead of JS
  salesSummary: managerReportsProcedure
    .input(z.object({
      tenantId: z.string().optional(),
      branchId: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        branch: { tenantId: ctx.auth.tenant.id },
        createdAt: {
          gte: new Date(input.startDate),
          lte: new Date(input.endDate),
        },
        status: 'PAID',
      };
      
      if (input.branchId) {
        where.branchId = input.branchId;
      }
      
      // OPTIMIZED: Use aggregate() to push SUM to PostgreSQL
      const [agg, orderCount] = await Promise.all([
        ctx.db.order.aggregate({
          where,
          _sum: {
            grandTotal: true,
          },
        }),
        ctx.db.order.count({ where }),
      ]);
      
      const totalRevenue = Number(agg._sum?.grandTotal ?? 0);
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
      
      // OPTIMIZED: Use groupBy for payment method breakdown
      const paymentGroups = await ctx.db.payment.groupBy({
        by: ['method'],
        where: {
          order: where,
          status: 'CAPTURED',
        },
        _sum: {
          amount: true,
        },
      });
      
      const paymentBreakdown: Record<string, number> = {};
      for (const g of paymentGroups) {
        paymentBreakdown[g.method] = Number(g._sum?.amount ?? 0);
      }
      
      // OPTIMIZED: Use groupBy for order type breakdown
      const orderTypeGroups = await ctx.db.order.groupBy({
        by: ['type'],
        where,
        _count: true,
      });
      
      const orderTypeBreakdown: Record<string, number> = {};
      for (const g of orderTypeGroups) {
        orderTypeBreakdown[g.type] = g._count;
      }
      
      return {
        totalRevenue,
        totalOrders: orderCount,
        avgOrderValue,
        paymentBreakdown,
        orderTypeBreakdown,
        // REMOVED: orders array - no caller uses it, pure wire bloat
      };
    }),
  
  // Top selling items - ALREADY OPTIMIZED with groupBy
  topItems: managerReportsProcedure
    .input(z.object({
      tenantId: z.string().optional(),
      branchId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        order: {
          branch: { tenantId: ctx.auth.tenant.id },
          status: 'PAID',
        },
      };
      
      if (input.branchId) {
        where.order.branchId = input.branchId;
      }
      
      if (input.startDate && input.endDate) {
        where.order.createdAt = {
          gte: new Date(input.startDate),
          lte: new Date(input.endDate),
        };
      }
      
      const items = await ctx.db.orderItem.groupBy({
        by: ['itemId'],
        where,
        _sum: {
          quantity: true,
          lineTotal: true,
        },
        _count: true,
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: input.limit,
      });
      
      // Fetch item details
      const itemIds = items.map(i => i.itemId);
      const menuItems = await ctx.db.item.findMany({
        where: { id: { in: itemIds } },
        include: { category: true },
      });
      
      return items.map(item => ({
        itemId: item.itemId,
        totalQuantity: item._sum.quantity || 0,
        totalRevenue: item._sum.lineTotal?.toNumber() || 0,
        orderCount: item._count,
        item: menuItems.find(m => m.id === item.itemId),
      }));
    }),
  
  // Daily sales — SQL GROUP BY date_trunc('day', createdAt).
  // Previous JS loop fetched every order row and grouped in Node; a month of
  // data (1k+ orders) wasted round-trip + JSON + GC. Now PostgreSQL groups
  // and sums server-side; result is ~30 rows regardless of volume.
  dailySales: managerReportsProcedure
    .input(z.object({
      tenantId: z.string().optional(),
      branchId: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const branchFilter = input.branchId
        ? Prisma.sql`AND o."branchId" = ${input.branchId}`
        : Prisma.empty;
      const rows = await ctx.db.$queryRaw<Array<{
        date: string;
        revenue: string;
        orders: string;
        tax: string;
        discount: string;
      }>>(
        Prisma.sql`
          SELECT
            (date_trunc('day', o."createdAt")::date)::text AS date,
            SUM(o."grandTotal")::text   AS revenue,
            COUNT(*)::text                AS orders,
            SUM(o."taxTotal")::text      AS tax,
            SUM(o."discountTotal")::text AS discount
          FROM "orders" o
          JOIN "branches" b ON b."id" = o."branchId"
          WHERE b."tenantId" = ${ctx.auth.tenant.id}
            AND o."status" = 'PAID'
            AND o."createdAt" >= ${new Date(input.startDate)}
            AND o."createdAt" <= ${new Date(input.endDate)}
            ${branchFilter}
          GROUP BY 1
          ORDER BY 1
        `,
      );
      return rows.map((r) => ({
        date: r.date,
        revenue: Number(r.revenue),
        orders: Number(r.orders),
        tax: Number(r.tax),
        discount: Number(r.discount),
      }));
    }),
  
  // GST report — SQL join orders×order_items, group by taxRate, compute
  // taxable base and tax in Postgres. Replaces N+1 include:{items} + JS
  // per-item Decimal math (Decimal slows 3x, variance on rounding).
  gstReport: managerReportsProcedure
    .input(z.object({
      tenantId: z.string().optional(),
      branchId: z.string().optional(),
      month: z.number().min(1).max(12),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0, 23, 59, 59);
      const branchFilter = input.branchId
        ? Prisma.sql`AND o."branchId" = ${input.branchId}`
        : Prisma.empty;
      const rows = await ctx.db.$queryRaw<Array<{
        rate: string;
        taxable: string;
        tax: string;
      }>>(
        Prisma.sql`
          SELECT
            oi."taxRate"::text                                   AS rate,
            SUM(oi."lineTotal" / (1 + oi."taxRate" / 100))::text AS taxable,
            SUM(oi."lineTotal" - oi."lineTotal"/(1+oi."taxRate"/100))::text AS tax
          FROM "order_items" oi
          JOIN "orders" o  ON o."id" = oi."orderId"
          JOIN "branches" b ON b."id" = o."branchId"
          WHERE b."tenantId" = ${ctx.auth.tenant.id}
            AND o."status" = 'PAID'
            AND o."createdAt" >= ${startDate}
            AND o."createdAt" <= ${endDate}
            ${branchFilter}
          GROUP BY oi."taxRate"
          ORDER BY oi."taxRate"
        `,
      );
      let totalCGST = 0;
      let totalSGST = 0;
      let totalTaxableValue = 0;
      const breakdown = rows.map((r) => {
        const taxableValue = Number(r.taxable);
        const taxAmount = Number(r.tax);
        totalTaxableValue += taxableValue;
        const cgst = taxAmount / 2;
        const sgst = taxAmount / 2;
        totalCGST += cgst;
        totalSGST += sgst;
        return { rate: Number(r.rate), taxableValue, cgst, sgst, igst: 0 };
      });
      return {
        month: input.month,
        year: input.year,
        totalTaxableValue,
        totalCGST,
        totalSGST,
        totalIGST: 0,
        totalGST: totalCGST + totalSGST,
        breakdown,
      };
    }),
  
  // Hourly sales — SQL extract(hour) + GROUP BY, single round-trip.
  // Previous path loaded all orders of the day then bucketed in JS.
  hourlySales: managerReportsProcedure
    .input(z.object({
      tenantId: z.string().optional(),
      branchId: z.string().optional(),
      date: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(input.date);
      endDate.setHours(23, 59, 59, 999);
      const branchFilter = input.branchId
        ? Prisma.sql`AND o."branchId" = ${input.branchId}`
        : Prisma.empty;
      const rows = await ctx.db.$queryRaw<Array<{ hour: number; revenue: string; orders: string }>>(
        Prisma.sql`
          SELECT
            extract(hour from o."createdAt")::int AS hour,
            SUM(o."grandTotal")::text              AS revenue,
            COUNT(*)::text                           AS orders
          FROM "orders" o
          JOIN "branches" b ON b."id" = o."branchId"
          WHERE b."tenantId" = ${ctx.auth.tenant.id}
            AND o."status" = 'PAID'
            AND o."createdAt" >= ${startDate}
            AND o."createdAt" <= ${endDate}
            ${branchFilter}
          GROUP BY 1
        `,
      );
      const byHour = new Map(rows.map((r) => [r.hour, { revenue: Number(r.revenue), orders: Number(r.orders) }]));
      return Array.from({ length: 24 }, (_, hour) => ({
        hour,
        revenue: byHour.get(hour)?.revenue ?? 0,
        orders: byHour.get(hour)?.orders ?? 0,
      }));
    }),
  
  // Inventory valuation
  inventoryValuation: managerReportsProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx }) => {
      const items = await ctx.db.inventoryItem.findMany({
        where: { tenantId: ctx.auth.tenant.id },
      });
      
      let totalValue = 0;
      let lowStockValue = 0;
      let lowStockCount = 0;
      
      const itemsWithValue = items.map(item => {
        const value = item.currentStock.toNumber() * item.unitCost.toNumber();
        totalValue += value;
        
        const isLowStock = item.currentStock.toNumber() <= item.minStockLevel.toNumber();
        if (isLowStock) {
          lowStockValue += value;
          lowStockCount += 1;
        }
        
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          currentStock: item.currentStock.toNumber(),
          unitCost: item.unitCost.toNumber(),
          value,
          isLowStock,
        };
      });
      
      return {
        totalValue,
        totalItems: items.length,
        lowStockCount,
        lowStockValue,
        items: itemsWithValue.sort((a, b) => b.value - a.value),
      };
    }),
});
