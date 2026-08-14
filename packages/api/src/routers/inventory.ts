import { z } from 'zod';
import { router, protectedProcedure, roleProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import type { InventoryItem } from '@zerosky/database';

const managerProcedure = roleProcedure('OWNER', 'MANAGER');

/**
 * Prisma hands back Decimal instances for the stock and cost columns, and
 * superjson has no serializer registered for that class. The client therefore
 * receives plain values with no Decimal methods, so calling `.toNumber()` on
 * them throws at render time. Convert at the API boundary instead — the same
 * approach `reports.ts` and `partner.ts` take.
 */
type SerializedInventoryItem<T extends InventoryItem> = Omit<
  T,
  'currentStock' | 'minStockLevel' | 'maxStockLevel' | 'reorderPoint' | 'unitCost'
> & {
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number | null;
  reorderPoint: number | null;
  unitCost: number;
};

function serializeInventoryItem<T extends InventoryItem>(item: T): SerializedInventoryItem<T> {
  return {
    ...item,
    currentStock: Number(item.currentStock),
    minStockLevel: Number(item.minStockLevel),
    maxStockLevel: item.maxStockLevel === null ? null : Number(item.maxStockLevel),
    reorderPoint: item.reorderPoint === null ? null : Number(item.reorderPoint),
    unitCost: Number(item.unitCost),
  };
}

export const inventoryRouter = router({
  // List inventory items
  list: protectedProcedure
    .input(z.object({
      // tenantId from context, not input — prevents IDOR
      tenantId: z.string().optional(),
      category: z.string().optional(),
      lowStock: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // tenantId from context, not input — prevents IDOR
      const where: any = { tenantId: ctx.auth.tenant.id };
      if (input.category) where.category = input.category;
      
      const items = await ctx.db.inventoryItem.findMany({
        where,
        include: { supplier: true },
        orderBy: { name: 'asc' },
      });
      
      const serialized = items.map(serializeInventoryItem);

      if (input.lowStock) {
        return serialized.filter((item) => item.currentStock <= item.minStockLevel);
      }

      return serialized;
    }),
  
  // Get single inventory item
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.inventoryItem.findFirst({
        where: { 
          id: input.id,
          tenantId: ctx.auth.tenant.id,
        },
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
      
      return serializeInventoryItem(item);
    }),
  
  // Create inventory item
  create: managerProcedure
    .input(z.object({
      // tenantId from context, not input — prevents IDOR
      tenantId: z.string().optional(),
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
      const { tenantId: _tenantId, ...rest } = input as { tenantId?: string } & typeof input;
      return serializeInventoryItem(
        await ctx.db.inventoryItem.create({
          // tenantId from context, not input — prevents IDOR
          data: { ...rest, tenantId: ctx.auth.tenant.id },
          include: { supplier: true },
        }),
      );
    }),
  
  // Update inventory item
  update: managerProcedure
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
      // tenant check — prevents IDOR
      const existing = await ctx.db.inventoryItem.findFirst({
        where: { id, tenantId: ctx.auth.tenant.id },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inventory item not found' });
      }
      return serializeInventoryItem(
        await ctx.db.inventoryItem.update({
          where: { id },
          data,
          include: { supplier: true },
        }),
      );
    }),
  
  // Delete inventory item
  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // tenant check — prevents IDOR
      const existing = await ctx.db.inventoryItem.findFirst({
        where: { id: input.id, tenantId: ctx.auth.tenant.id },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inventory item not found' });
      }
      return serializeInventoryItem(
        await ctx.db.inventoryItem.delete({
          where: { id: input.id },
        }),
      );
    }),
  
  // Adjust stock (add/remove/adjust/wastage)
  adjustStock: managerProcedure
    .input(z.object({
      inventoryItemId: z.string(),
      // tenantId from context, not input — prevents IDOR
      tenantId: z.string().optional(),
      type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'WASTAGE']),
      quantity: z.number(),
      reason: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // tenantId from context, not input — prevents IDOR
      // Verify inventoryItem belongs to tenant
      const item = await ctx.db.inventoryItem.findFirst({
        where: { id: input.inventoryItemId, tenantId: ctx.auth.tenant.id },
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
            // tenantId from context, not input — prevents IDOR
            tenantId: ctx.auth.tenant.id,
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
      
      return serializeInventoryItem(updatedItem);
    }),
  
  // Get low stock alerts
  lowStockAlerts: protectedProcedure
    .input(z.object({
      // tenantId from context, not input — prevents IDOR
      tenantId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // tenantId from context, not input — prevents IDOR
      const items = await ctx.db.inventoryItem.findMany({
        where: { tenantId: ctx.auth.tenant.id },
        include: { supplier: true },
      });
      
      return items
        .map(serializeInventoryItem)
        .filter((item) => item.currentStock <= item.minStockLevel);
    }),
  
  // Get stock history for an item
  stockHistory: protectedProcedure
    .input(z.object({
      inventoryItemId: z.string(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const owned = await ctx.db.inventoryItem.findFirst({
        where: { id: input.inventoryItemId, tenantId: ctx.auth.tenant.id },
      });
      if (!owned) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Inventory item not found' });
      }
      return ctx.db.stockAdjustment.findMany({
        where: { inventoryItemId: input.inventoryItemId },
        include: { performedBy: true },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),
});
