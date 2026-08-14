// Supplier router.
//
// Full CRUD for supplier management. Not yet surfaced in the UI — inventory
// items can reference suppliers, but there's no dedicated supplier management
// screen. When building UI, wire to the existing procedures here.

import { z } from 'zod';
import { router, protectedProcedure, roleProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';

const managerProcedure = roleProcedure('OWNER', 'MANAGER');

export const supplierRouter = router({
  // List suppliers
  list: managerProcedure
    .input(z.object({
      // tenantId from context, not input — prevents IDOR
      tenantId: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // tenantId from context, not input — prevents IDOR
      const where: any = { tenantId: ctx.auth.tenant.id };
      if (input.isActive !== undefined) {
        where.isActive = input.isActive;
      }
      
      return ctx.db.supplier.findMany({
        where,
        include: {
          _count: {
            select: { inventoryItems: true, purchaseOrders: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    }),
  
  // Get single supplier
  get: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const supplier = await ctx.db.supplier.findFirst({
        where: { id: input.id, tenantId: ctx.auth.tenant.id },
        include: {
          inventoryItems: true,
          purchaseOrders: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
      
      if (!supplier) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Supplier not found' });
      }
      
      return supplier;
    }),
  
  // Create supplier
  create: managerProcedure
    .input(z.object({
      // tenantId from context, not input — prevents IDOR
      tenantId: z.string().optional(),
      name: z.string().min(1),
      contactPerson: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { tenantId: _tenantId, ...rest } = input as { tenantId?: string } & typeof input;
      return ctx.db.supplier.create({
        // tenantId from context, not input — prevents IDOR
        data: { ...rest, tenantId: ctx.auth.tenant.id },
      });
    }),
  
  // Update supplier
  update: managerProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      contactPerson: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.supplier.findFirst({
        where: { id, tenantId: ctx.auth.tenant.id },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Supplier not found' });
      }
      return ctx.db.supplier.update({
        where: { id },
        data,
      });
    }),
  
  // Delete supplier
  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.supplier.findFirst({
        where: { id: input.id, tenantId: ctx.auth.tenant.id },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Supplier not found' });
      }
      // Check if supplier has inventory items
      const itemsCount = await ctx.db.inventoryItem.count({
        where: { supplierId: input.id },
      });
      
      if (itemsCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot delete supplier with existing inventory items',
        });
      }
      
      return ctx.db.supplier.delete({
        where: { id: input.id },
      });
    }),
});
