// Payment router input schemas.
import { z } from "zod";
import { idSchema, moneySchema } from "./common.js";

export const paymentMethodSchema = z.enum([
  "CASH",
  "CARD",
  "UPI",
  "WALLET",
  "AGGREGATOR",
  "COMPLIMENTARY",
]);

export const paymentStatusSchema = z.enum([
  "PENDING",
  "CAPTURED",
  "FAILED",
  "REFUNDED",
]);

export const recordPaymentSchema = z
  .object({
    orderId: idSchema,
    method: paymentMethodSchema,
    amount: moneySchema,
    reference: z.string().trim().max(200).optional(),
    status: paymentStatusSchema.default("CAPTURED"),
  })
  .strict();

export const listPaymentsSchema = z
  .object({
    orderId: idSchema.optional(),
    branchId: idSchema.optional(),
  })
  .strict();

export const refundPaymentSchema = z
  .object({ id: idSchema, reference: z.string().trim().max(200).optional() })
  .strict();

export const setPaymentStatusSchema = z
  .object({ id: idSchema, status: paymentStatusSchema })
  .strict();
