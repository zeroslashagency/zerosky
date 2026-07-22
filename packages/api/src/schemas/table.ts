// Table router input schemas.
import { z } from "zod";
import { idSchema, nameSchema } from "./common.js";

export const tableStateSchema = z.enum([
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "BILLED",
  "CLEANING",
]);

export const listTablesSchema = z
  .object({ branchId: idSchema })
  .strict();

export const createTableSchema = z
  .object({
    branchId: idSchema,
    name: nameSchema,
    section: z.string().trim().max(100).optional(),
    seats: z.number().int().min(1).max(100).default(4),
  })
  .strict();

export const updateTableSchema = z
  .object({
    id: idSchema,
    name: nameSchema.optional(),
    section: z.string().trim().max(100).nullable().optional(),
    seats: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const setTableStateSchema = z
  .object({ id: idSchema, state: tableStateSchema })
  .strict();
