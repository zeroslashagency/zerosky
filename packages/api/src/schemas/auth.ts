// Auth router input schemas.
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, "password is required"),
  tenantSlug: z.string().trim().min(1),
});

export const pinLoginSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits"),
  tenantSlug: z.string().trim().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refresh token is required"),
});
