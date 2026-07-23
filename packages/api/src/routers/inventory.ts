import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';

export const inventoryRouter = router({
  // List inventory items
  list: protectedProcedure
    .input(z.object({
      tenantId: z.string(),
      category: z.string().optional(),
      lowStock: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { tenantId: input.tenantId };
      if (input.category) where.category = input.category;
      
      const items = await ctx.db.inventoryItem.findMany({
        where,
        include: { supplier: true },
        orderBy: { name: 'asc' },
      });
      
      if (input.lowStock) {
        return items.filter((item) => 
          item.currentStock.toNumber() <= item.minStockLevel.toNumber()
        );
      }
      
      return items;
    }),
  
  // Get single inventory item
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.inventoryItem.findUnique({
        where: { id: input.id },
        include: { 
          supplier: true,
          stockAdjustments: {
            include: { performedBy: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      });
      
      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inventory item not found' });
      }
      
      return item;
    }),
  
  // Create inventory item
  create: protectedProcedure
    .input(z.object({
      tenantId: z.string(),
      name: z.string().min(1),
      sku: z.string().optional(),
      category: z.string().min(1),
      unit: z.string().min(1),
      currentStock: z.number().min(0),
      minStockLevel: z.number().min(0),
      maxStockLevel: z.number().min(0).optional(),
      reorderPoint: z.number().min(0).optional(),
      unitCost: z.number().min(0),
      supplierId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.inventoryItem.create({
        data: input,
        include: { supplier: true },
      });
    }),
  
  // Update inventory item
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      unit: z.string().min(1).optional(),
      minStockLevel: z.number().min(0).optional(),
      maxStockLevel: z.number().min(0).optional(),
      reorderPoint: z.number().min(0).optional(),
      unitCost: z.number().min(0).optional(),
      supplierId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.inventoryItem.update({
        where: { id },
        data,
        include: { supplier: true },
      });
    }),
  
  // Delete inventory item
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.inventoryItem.delete({
        where: { id: input.id },
      });
    }),
  
  // Adjust stock (add/remove/adjust/wastage)
  adjustStock: protectedProcedure
    .input(z.object({
      inventoryItemId: z.string(),
      tenantId: z.string(),
      type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'WASTAGE']),
      quantity: z.number(),
      reason: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.inventoryItem.findUnique({
        where: { id: input.inventoryItemId },
      });
      
      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inventory item not found' });
      }
      
      const previousStock = item.currentStock.toNumber();
      let newStock: number;
      
      if (input.type === 'IN' || input.type === 'ADJUSTMENT') {
        newStock = previousStock + input.quantity;
      } else {
        newStock = previousStock - input.quantity;
      }
      
      if (newStock < 0) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Stock cannot be negative' 
        });
      }
      
      const [updatedItem] = await ctx.db.$transaction([
        ctx.db.inventoryItem.update({
          where: { id: input.inventoryItemId },
          data: { currentStock: newStock },
        }),
        ctx.db.stockAdjustment.create({
          data: {
            tenantId: input.tenantId,
            inventoryItemId: input.inventoryItemId,
            type: input.type,
            quantity: input.quantity,
            previousStock,
            newStock,
            reason: input.reason,
            notes: input.notes,
            performedById: ctx.auth.user.id,
          },
        }),
      ]);
      
      return updatedItem;
    }),
  
  // Get low stock alerts
  lowStockAlerts: protectedProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.inventoryItem.findMany({
        where: { tenantId: input.tenantId },
        include: { supplier: true },
      });
      
      return items.filter((item) => 
        item.currentStock.toNumber() <= item.minStockLevel.toNumber()
      );
    }),
  
  // Get stock history for an item
  stockHistory: protectedProcedure
    .input(z.object({
      inventoryItemId: z.string(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.stockAdjustment.findMany({
        where: { inventoryItemId: input.inventoryItemId },
        include: { performedBy: true },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),
});
