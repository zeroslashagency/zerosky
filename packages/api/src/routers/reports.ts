import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';

export const reportsRouter = router({
  // Sales summary - OPTIMIZED: aggregate in PostgreSQL instead of JS
  salesSummary: protectedProcedure
    .input(z.object({
      tenantId: z.string(),
      branchId: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        branch: { tenantId: input.tenantId },
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
  topItems: protectedProcedure
    .input(z.object({
      tenantId: z.string(),
      branchId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        order: {
          branch: { tenantId: input.tenantId },
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
  
  // Daily sales report - OPTIMIZED: select only needed columns, group in SQL
  dailySales: protectedProcedure
    .input(z.object({
      tenantId: z.string(),
      branchId: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        branch: { tenantId: input.tenantId },
        createdAt: {
          gte: new Date(input.startDate),
          lte: new Date(input.endDate),
        },
        status: 'PAID',
      };
      
      if (input.branchId) {
        where.branchId = input.branchId;
      }
      
      // Still fetch rows because Prisma doesn't support EXTRACT(date) in groupBy
      // But at least select only the columns we need
      const orders = await ctx.db.order.findMany({
        where,
        select: {
          createdAt: true,
          grandTotal: true,
          subtotal: true,
          taxTotal: true,
          discountTotal: true,
        },
      });
      
      // Group by date
      const dailyData: Record<string, {
        date: string;
        revenue: number;
        orders: number;
        tax: number;
        discount: number;
      }> = {};
      
      orders.forEach(order => {
        const dateKey = order.createdAt.toISOString().split('T')[0];
        if (!dateKey) return;
        
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            date: dateKey,
            revenue: 0,
            orders: 0,
            tax: 0,
            discount: 0,
          };
        }
        dailyData[dateKey]!.revenue += order.grandTotal.toNumber();
        dailyData[dateKey]!.orders += 1;
        dailyData[dateKey]!.tax += order.taxTotal.toNumber();
        dailyData[dateKey]!.discount += order.discountTotal.toNumber();
      });
      
      return Object.values(dailyData).sort((a, b) => 
        a.date.localeCompare(b.date)
      );
    }),
  
  // GST report - select only needed columns
  gstReport: protectedProcedure
    .input(z.object({
      tenantId: z.string(),
      branchId: z.string().optional(),
      month: z.number().min(1).max(12),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0, 23, 59, 59);
      
      const where: any = {
        branch: { tenantId: input.tenantId },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: 'PAID',
      };
      
      if (input.branchId) {
        where.branchId = input.branchId;
      }
      
      const orders = await ctx.db.order.findMany({
        where,
        include: {
          items: { 
            select: {
              lineTotal: true,
              taxRate: true,
            }
          },
        },
      });
      
      let totalCGST = 0;
      let totalSGST = 0;
      let totalIGST = 0;
      let totalTaxableValue = 0;
      
      // Group by tax rate
      const taxBreakdown: Record<string, {
        rate: number;
        taxableValue: number;
        cgst: number;
        sgst: number;
        igst: number;
      }> = {};
      
      orders.forEach(order => {
        order.items.forEach(item => {
          const taxRate = item.taxRate.toNumber();
          const baseAmount = item.lineTotal.toNumber() / (1 + taxRate / 100);
          const taxAmount = item.lineTotal.toNumber() - baseAmount;
          
          totalTaxableValue += baseAmount;
          
          // Assuming intra-state for CGST/SGST split
          const cgst = taxAmount / 2;
          const sgst = taxAmount / 2;
          
          totalCGST += cgst;
          totalSGST += sgst;
          
          // Group by rate
          const rateKey = taxRate.toString();
          if (!taxBreakdown[rateKey]) {
            taxBreakdown[rateKey] = {
              rate: taxRate,
              taxableValue: 0,
              cgst: 0,
              sgst: 0,
              igst: 0,
            };
          }
          taxBreakdown[rateKey].taxableValue += baseAmount;
          taxBreakdown[rateKey].cgst += cgst;
          taxBreakdown[rateKey].sgst += sgst;
        });
      });
      
      return {
        month: input.month,
        year: input.year,
        totalTaxableValue,
        totalCGST,
        totalSGST,
        totalIGST,
        totalGST: totalCGST + totalSGST + totalIGST,
        breakdown: Object.values(taxBreakdown),
      };
    }),
  
  // Hourly sales - select only needed columns
  hourlySales: protectedProcedure
    .input(z.object({
      tenantId: z.string(),
      branchId: z.string().optional(),
      date: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(input.date);
      endDate.setHours(23, 59, 59, 999);
      
      const where: any = {
        branch: { tenantId: input.tenantId },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: 'PAID',
      };
      
      if (input.branchId) {
        where.branchId = input.branchId;
      }
      
      const orders = await ctx.db.order.findMany({
        where,
        select: {
          createdAt: true,
          grandTotal: true,
        },
      });
      
      // Group by hour
      const hourlyData: Record<number, { hour: number; revenue: number; orders: number }> = {};
      
      for (let i = 0; i < 24; i++) {
        hourlyData[i] = { hour: i, revenue: 0, orders: 0 };
      }
      
      orders.forEach(order => {
        const hour = order.createdAt.getHours();
        if (hourlyData[hour]) {
          hourlyData[hour]!.revenue += order.grandTotal.toNumber();
          hourlyData[hour]!.orders += 1;
        }
      });
      
      return Object.values(hourlyData);
    }),
  
  // Inventory valuation
  inventoryValuation: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.inventoryItem.findMany({
        where: { tenantId: input.tenantId },
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
