// Order router input schemas.
import { z } from "zod";
import { idSchema } from "./common.js";

export const orderTypeSchema = z.enum([
  "DINE_IN",
  "TAKEAWAY",
  "DELIVERY",
  "AGGREGATOR",
]);

export const orderStatusSchema = z.enum([
  "OPEN",
  "SENT_TO_KITCHEN",
  "READY",
  "SERVED",
  "BILLED",
  "PAID",
  "CANCELLED",
]);

export const orderLineSchema = z
  .object({
    itemId: idSchema,
    quantity: z.number().int().min(1).max(999),
    notes: z.string().trim().max(500).optional(),
    seat: z.number().int().min(1).max(99).optional(),
  })
  .strict();

export const createOrderSchema = z
  .object({
    branchId: idSchema,
    tableId: idSchema.optional(),
    type: orderTypeSchema.default("DINE_IN"),
    guestCount: z.number().int().min(1).max(999).default(1),
    notes: z.string().trim().max(500).optional(),
    items: z.array(orderLineSchema).min(1),
  })
  .strict();

export const addItemsSchema = z
  .object({
    orderId: idSchema,
    items: z.array(orderLineSchema).min(1),
  })
  .strict();

export const listOrdersSchema = z
  .object({
    branchId: idSchema,
    status: orderStatusSchema.optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .strict();

export const getOrderSchema = z.object({ id: idSchema }).strict();

export const setOrderStatusSchema = z
  .object({ id: idSchema, status: orderStatusSchema })
  .strict();

export const cancelOrderSchema = z
  .object({ id: idSchema, reason: z.string().trim().max(500).optional() })
  .strict();
