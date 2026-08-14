import { z } from 'zod';
import { router, protectedProcedure, roleProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import type { Partner } from '@zerosky/database';

const managerProcedure = roleProcedure('OWNER', 'MANAGER');

/**
 * Prisma returns `revenueSharePercent` as a Decimal instance, and superjson has
 * no serializer registered for that class. The client therefore receives a
 * plain value with no `.toNumber()` / `.toString()` Decimal methods on it, and
 * calling them throws at render time. Convert at the API boundary instead —
 * this is the same approach `reports.ts` already takes with money columns.
 */
function serializePartner<T extends Partner>(partner: T): Omit<T, 'revenueSharePercent'> & {
  revenueSharePercent: number;
} {
  return {
    ...partner,
    revenueSharePercent: Number(partner.revenueSharePercent),
  };
}

export const partnerRouter = router({
  // List partners
  list: managerProcedure
    .input(z.object({
      isActive: z.boolean().optional(),
      type: z.enum(['FRANCHISE', 'PARTNER', 'INVESTOR']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.isActive !== undefined) {
        where.isActive = input.isActive;
      }
      if (input.type) {
        where.type = input.type;
      }
      
      const partners = await ctx.db.partner.findMany({
        where: {
          ...where,
          branches: { some: { branch: { tenantId: ctx.auth.tenant.id } } },
        },
        include: {
          branches: {
            where: { branch: { tenantId: ctx.auth.tenant.id } },
            include: { branch: true },
          },
          _count: {
            select: { branches: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Also include unassigned partners? No — partner without branch has no tenant, not shown. Tight scoping prevents cross-tenant leak.
      return partners.map(serializePartner);
    }),
  
  // Get single partner
  get: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const partner = await ctx.db.partner.findUnique({
        where: { id: input.id },
        include: {
          branches: {
            include: {
              branch: {
                include: {
                  tenant: true,
                },
              },
            },
          },
        },
      });
      
      if (!partner) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Partner not found' });
      }
      const hasTenantBranch = partner.branches.some((bp) => bp.branch.tenantId === ctx.auth.tenant.id);
      if (partner.branches.length > 0 && !hasTenantBranch) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Partner not found' });
      }
      
      return serializePartner(partner);
    }),
  
  // Create partner
  create: managerProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      type: z.enum(['FRANCHISE', 'PARTNER', 'INVESTOR']).default('FRANCHISE'),
      revenueSharePercent: z.number().min(0).max(100).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if email already exists
      const existing = await ctx.db.partner.findUnique({
        where: { email: input.email },
      });
      
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Partner with this email already exists',
        });
      }
      
      return serializePartner(
        await ctx.db.partner.create({
          data: input,
        }),
      );
    }),
  
  // Update partner
  update: managerProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      type: z.enum(['FRANCHISE', 'PARTNER', 'INVESTOR']).optional(),
      revenueSharePercent: z.number().min(0).max(100).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.partner.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Partner not found' });
      }
      return serializePartner(
        await ctx.db.partner.update({
          where: { id },
          data,
        }),
      );
    }),
  
  // Delete partner
  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if partner has branches
      const branchCount = await ctx.db.branchPartner.count({
        where: { partnerId: input.id },
      });
      
      if (branchCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot delete partner with associated branches',
        });
      }
      
      return serializePartner(
        await ctx.db.partner.delete({
          where: { id: input.id },
        }),
      );
    }),
  
  // Assign partner to branch
  assignBranch: managerProcedure
    .input(z.object({
      partnerId: z.string(),
      branchId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const branch = await ctx.db.branch.findFirst({
        where: { id: input.branchId, tenantId: ctx.auth.tenant.id },
      });
      if (!branch) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Branch not found' });
      }
      // Check if already assigned
      const existing = await ctx.db.branchPartner.findUnique({
        where: {
          branchId_partnerId: {
            branchId: input.branchId,
            partnerId: input.partnerId,
          },
        },
      });
      
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Partner already assigned to this branch',
        });
      }
      
      const assignment = await ctx.db.branchPartner.create({
        data: {
          partnerId: input.partnerId,
          branchId: input.branchId,
        },
        include: {
          partner: true,
          branch: true,
        },
      });

      return { ...assignment, partner: serializePartner(assignment.partner) };
    }),
  
  // Remove partner from branch
  removeBranch: managerProcedure
    .input(z.object({
      partnerId: z.string(),
      branchId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const branch = await ctx.db.branch.findFirst({
        where: { id: input.branchId, tenantId: ctx.auth.tenant.id },
      });
      if (!branch) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Branch not found' });
      }
      return ctx.db.branchPartner.delete({
        where: {
          branchId_partnerId: {
            branchId: input.branchId,
            partnerId: input.partnerId,
          },
        },
      });
    }),
  
  // Get partner performance report
  performance: managerProcedure
    .input(z.object({
      partnerId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const partner = await ctx.db.partner.findUnique({
        where: { id: input.partnerId },
        include: {
          branches: {
            include: { branch: true },
          },
        },
      });
      
      if (!partner) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Partner not found' });
      }
      const tenantBranchIds = partner.branches.filter((bp) => bp.branch.tenantId === ctx.auth.tenant.id).map((bp) => bp.branchId);
      if (tenantBranchIds.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Partner not found' });
      }
      const branchIds = tenantBranchIds;
      
      // Get orders for partner's branches
      const orders = await ctx.db.order.findMany({
        where: {
          branchId: { in: branchIds },
          createdAt: {
            gte: new Date(input.startDate),
            lte: new Date(input.endDate),
          },
          status: 'PAID',
        },
      });
      
      const totalRevenue = orders.reduce((sum, order) => 
        sum + order.grandTotal.toNumber(), 0
      );
      const totalOrders = orders.length;
      const partnerShare = (totalRevenue * partner.revenueSharePercent.toNumber()) / 100;
      
      // Group by branch
      const branchPerformance = partner.branches.map(bp => {
        const branchOrders = orders.filter(o => o.branchId === bp.branchId);
        const branchRevenue = branchOrders.reduce((sum, order) => 
          sum + order.grandTotal.toNumber(), 0
        );
        
        return {
          branchId: bp.branchId,
          branchName: bp.branch.name,
          orders: branchOrders.length,
          revenue: branchRevenue,
        };
      });
      
      return {
        partner: {
          id: partner.id,
          name: partner.name,
          type: partner.type,
          revenueSharePercent: partner.revenueSharePercent.toNumber(),
        },
        totalRevenue,
        totalOrders,
        partnerShare,
        branchPerformance,
      };
    }),
});
