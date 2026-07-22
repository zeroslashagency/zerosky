// Menu router.
import { TRPCError } from "@trpc/server";
import { createItemSchema, createMenuSchema, getItemSchema, listMenusSchema, setItemAvailabilitySchema } from "../schemas/menu.js";
import { protectedProcedure, roleProcedure, router } from "../trpc.js";

const menuAdminProcedure = roleProcedure("OWNER", "MANAGER");

export const menuRouter = router({
  list: protectedProcedure.input(listMenusSchema).query(async ({ ctx, input }) => {
    return ctx.db.menu.findMany({
      where: {
        tenantId: ctx.auth.tenant.id,
        ...(input.includeInactive ? {} : { isActive: true }),
      },
      include: {
        categories: {
          where: input.includeInactive ? {} : { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  createMenu: menuAdminProcedure.input(createMenuSchema).mutation(async ({ ctx, input }) => {
    return ctx.db.menu.create({
      data: { tenantId: ctx.auth.tenant.id, name: input.name, isDefault: input.isDefault },
    });
  }),

  createItem: menuAdminProcedure.input(createItemSchema).mutation(async ({ ctx, input }) => {
    const category = await ctx.db.category.findFirst({
      where: { id: input.categoryId, menu: { tenantId: ctx.auth.tenant.id } },
    });
    if (!category) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Category not found." });
    }
    return ctx.db.item.create({
      data: {
        categoryId: category.id,
        name: input.name,
        description: input.description,
        price: input.price,
        taxRate: input.taxRate,
        isVeg: input.isVeg,
        sku: input.sku,
        sortOrder: input.sortOrder,
      },
    });
  }),

  getItem: protectedProcedure.input(getItemSchema).query(async ({ ctx, input }) => {
    const item = await ctx.db.item.findFirst({
      where: { id: input.id, category: { menu: { tenantId: ctx.auth.tenant.id } } },
    });
    if (!item) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
    }
    return item;
  }),

  setItemAvailability: roleProcedure("OWNER", "MANAGER", "CASHIER", "WAITER")
    .input(setItemAvailabilitySchema)
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.item.findFirst({
        where: { id: input.id, category: { menu: { tenantId: ctx.auth.tenant.id } } },
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found." });
      }
      return ctx.db.item.update({ where: { id: input.id }, data: { isAvailable: input.isAvailable } });
    }),
});
