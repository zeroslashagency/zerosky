// Menu router input schemas.
import { z } from "zod";
import { idSchema, moneySchema, nameSchema } from "./common.js";

export const listMenusSchema = z.object({
  includeInactive: z.boolean().default(false),
}).default({ includeInactive: false });

export const createMenuSchema = z.object({
  name: nameSchema,
  isDefault: z.boolean().default(false),
});

export const createItemSchema = z.object({
  categoryId: idSchema,
  name: nameSchema,
  description: z.string().trim().max(1000).optional(),
  price: moneySchema,
  taxRate: z.number().min(0).max(100).default(5),
  isVeg: z.boolean().default(true),
  sku: z.string().trim().max(64).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const getItemSchema = z.object({ id: idSchema });
export const setItemAvailabilitySchema = z.object({
  id: idSchema,
  isAvailable: z.boolean(),
});
