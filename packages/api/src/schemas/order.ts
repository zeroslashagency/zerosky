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

const modifierOptionSchema = z.object({
  id: idSchema,
  name: z.string(),
  price: z.number(),
});

const modifierGroupSchema = z.object({
  groupId: idSchema,
  groupName: z.string(),
  options: z.array(modifierOptionSchema),
});

export const orderLineSchema = z
  .object({
    itemId: idSchema,
    quantity: z.number().int().min(1).max(999),
    modifiers: z.array(modifierGroupSchema).optional(),
    notes: z.string().trim().max(500).optional(),
    seat: z.number().int().min(1).max(99).optional(),
    // Rupees taken off this whole line (not per unit) before GST. Validated
    // against the gross line value in priceLines() so it can never drive the
    // taxable base negative.
    discountAmount: z.number().min(0).optional(),
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

export const discountTypeSchema = z.enum(["PERCENT", "FLAT"]);

export const applyDiscountSchema = z
  .object({
    orderId: idSchema,
    type: discountTypeSchema,
    // A percent is 0–100; a flat amount is any non-negative rupee value. The
    // ceiling (flat ≤ subtotal) is enforced in the procedure where the
    // subtotal is known.
    value: z.number().min(0),
    reason: z.string().trim().min(1).max(500),
  })
  .strict()
  .refine((v) => v.type !== "PERCENT" || v.value <= 100, {
    message: "A percentage discount cannot exceed 100%.",
    path: ["value"],
  });

export const removeDiscountSchema = z.object({ orderId: idSchema }).strict();

export const setOrderStatusSchema = z
  .object({ id: idSchema, status: orderStatusSchema })
  .strict();

export const cancelOrderSchema = z
  .object({ id: idSchema, reason: z.string().trim().max(500).optional() })
  .strict();
