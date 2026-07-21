// KOT router input schemas.
import { z } from "zod";
import { idSchema } from "./common.js";

export const kotStatusSchema = z.enum([
  "NEW",
  "MODIFIED",
  "PARTIAL",
  "READY",
  "SERVED",
  "CANCELLED",
]);

export const generateKotSchema = z
  .object({
    orderId: idSchema,
    station: z.string().trim().max(100).optional(),
  })
  .strict();

export const listKotsSchema = z
  .object({
    orderId: idSchema.optional(),
    branchId: idSchema.optional(),
    status: kotStatusSchema.optional(),
  })
  .strict();

export const setKotStatusSchema = z
  .object({ id: idSchema, status: kotStatusSchema })
  .strict();

export const markKotPrintedSchema = z.object({ id: idSchema }).strict();
