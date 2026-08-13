// Print router input schemas.
import { z } from "zod";
import { idSchema } from "./common.js";

export const printKotSchema = z
  .object({
    kotId: idSchema,
  })
  .strict();

export const reprintKotSchema = z
  .object({
    kotId: idSchema,
  })
  .strict();

export const printBillSchema = z
  .object({
    orderId: idSchema,
    /** Whether to render as a full GST invoice (true) or a simple receipt (false). */
    fullInvoice: z.boolean().default(false),
  })
  .strict();

export const openCashDrawerSchema = z.object({}).strict();
