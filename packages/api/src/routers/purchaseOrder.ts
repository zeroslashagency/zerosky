// Purchase order router.
//
// Full workflow for creating, tracking, and receiving purchase orders from
// suppliers. Not yet surfaced in the UI — no purchase order screen exists.
// When building UI, wire to the existing procedures here.

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';

export const purchaseOrderRouter = router({
  // List purchase orders
  list: protectedProcedure
    .input(z.object({
      // tenantId from context, not input — prevents IDOR
      tenantId: z.string().optional(),
      status: z.enum(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED']).optional(),
      supplierId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // tenantId from context, not input — prevents IDOR
      const where: any = { tenantId: ctx.auth.tenant.id };
      if (input.status) where.status = input.status;
      if (input.supplierId) where.supplierId = input.supplierId;
      
      return ctx.db.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          createdBy: { select: { id: true, name: true, email: true } },
          items: {
            include: { inventoryItem: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),
  
  // Get single purchase order
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.db.purchaseOrder.findUnique({
        where: { id: input.id },
        include: {
          supplier: true,
          createdBy: { select: { id: true, name: true, email: true } },
          items: {
            include: { inventoryItem: true },
          },
        },
      });
      
      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
      }
      
      return order;
    }),
  
  // Create purchase order
  create: protectedProcedure
    .input(z.object({
      // tenantId from context, not input — prevents IDOR
      tenantId: z.string().optional(),
      supplierId: z.string(),
      expectedDate: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        inventoryItemId: z.string(),
        quantity: z.number().min(0.01),
        unitCost: z.number().min(0),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // tenantId from context, not input — prevents IDOR
      // Generate order number scoped to tenant
      const lastOrder = await ctx.db.purchaseOrder.findFirst({
        where: { tenantId: ctx.auth.tenant.id },
        orderBy: { createdAt: 'desc' },
        select: { orderNumber: true },
      });
      
      const nextNumber = lastOrder 
        ? parseInt(lastOrder.orderNumber.replace('PO', '')) + 1 
        : 1;
      const orderNumber = `PO${nextNumber.toString().padStart(6, '0')}`;
      
      // Calculate total
      const totalAmount = input.items.reduce((sum, item) => 
        sum + (item.quantity * item.unitCost), 0
      );
      
      return ctx.db.purchaseOrder.create({
        data: {
          // tenantId from context, not input — prevents IDOR
          tenantId: ctx.auth.tenant.id,
          orderNumber,
          supplierId: input.supplierId,
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          notes: input.notes,
          totalAmount,
          createdById: ctx.auth.user.id,
          items: {
            create: input.items.map(item => ({
              inventoryItemId: item.inventoryItemId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              totalCost: item.quantity * item.unitCost,
            })),
          },
        },
        include: {
          supplier: true,
          items: { include: { inventoryItem: true } },
        },
      });
    }),
  
  // Update purchase order status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(['DRAFT', 'SENT', 'RECEIVED', 'CANCELLED']),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: any = { status: input.status };
      
      if (input.status === 'RECEIVED') {
        updateData.receivedDate = new Date();
      }
      
      return ctx.db.purchaseOrder.update({
        where: { id: input.id },
        data: updateData,
        include: {
          supplier: true,
          items: { include: { inventoryItem: true } },
        },
      });
    }),
  
  // Receive purchase order (update inventory)
  receive: protectedProcedure
    .input(z.object({
      id: z.string(),
      // tenantId from context, not input — prevents IDOR
      tenantId: z.string().optional(),
      items: z.array(z.object({
        purchaseOrderItemId: z.string(),
        receivedQuantity: z.number().min(0),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // tenantId from context, not input — prevents IDOR
      const order = await ctx.db.purchaseOrder.findFirst({
        where: { id: input.id, tenantId: ctx.auth.tenant.id },
        include: { items: true },
      });
      
      if (!order) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Purchase order not found' });
      }
      
      if (order.status === 'RECEIVED') {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Purchase order already received' 
        });
      }
      
      // Process each item
      const updates = await Promise.all(
        input.items.map(async (receivedItem) => {
          const orderItem = order.items.find(i => i.id === receivedItem.purchaseOrderItemId);
          if (!orderItem) return null;
          
          // Update purchase order item
          await ctx.db.purchaseOrderItem.update({
            where: { id: receivedItem.purchaseOrderItemId },
            data: { receivedQuantity: receivedItem.receivedQuantity },
          });
          
          // Update inventory stock
          const inventoryItem = await ctx.db.inventoryItem.findUnique({
            where: { id: orderItem.inventoryItemId },
          });
          
          if (!inventoryItem) return null;
          
          const previousStock = inventoryItem.currentStock.toNumber();
          const newStock = previousStock + receivedItem.receivedQuantity;
          
          await ctx.db.$transaction([
            ctx.db.inventoryItem.update({
              where: { id: orderItem.inventoryItemId },
              data: { currentStock: newStock },
            }),
            ctx.db.stockAdjustment.create({
              data: {
                // tenantId from context, not input — prevents IDOR
                tenantId: ctx.auth.tenant.id,
                inventoryItemId: orderItem.inventoryItemId,
                type: 'IN',
                quantity: receivedItem.receivedQuantity,
                previousStock,
                newStock,
                reason: `Purchase Order ${order.orderNumber}`,
                performedById: ctx.auth.user.id,
              },
            }),
          ]);
          
          return orderItem.inventoryItemId;
        })
      );
      
      // Update order status
      const updatedOrder = await ctx.db.purchaseOrder.update({
        where: { id: input.id },
        data: {
          status: 'RECEIVED',
          receivedDate: new Date(),
        },
        include: {
          supplier: true,
          items: { include: { inventoryItem: true } },
        },
      });
      
      return updatedOrder;
    }),
  
  // Delete purchase order
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.db.purchaseOrder.findUnique({
        where: { id: input.id },
      });
      
      if (order?.status === 'RECEIVED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete received purchase order',
        });
      }
      
      return ctx.db.purchaseOrder.delete({
        where: { id: input.id },
      });
    }),
});
