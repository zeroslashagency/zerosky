// Shared Zod primitives reused across router input schemas.

import { z } from "zod";

/** cuid-style id used by all Prisma models (@default(cuid())). */
export const idSchema = z.string().min(1, "id is required");

/** Non-empty, trimmed display name. */
export const nameSchema = z.string().trim().min(1).max(200);

/** Monetary amount with 2-decimal precision, non-negative. */
export const moneySchema = z
  .number()
  .nonnegative()
  .refine((n) => Number.isFinite(n), "amount must be finite")
  .refine(
    (n) => Math.round(n * 100) === n * 100,
    "amount supports at most 2 decimal places",
  );

/** Standard cursor pagination input. */
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: idSchema.optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;
