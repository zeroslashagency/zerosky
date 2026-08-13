// @zerosky/auth — JWT secret resolution from the environment.
//
// Secrets are NEVER hardcoded. Production must supply `JWT_SECRET` (and
// optionally a distinct `JWT_REFRESH_SECRET`); a missing or weak secret is a
// hard startup failure. Development may fall back to a per-process ephemeral
// secret, which invalidates every session on restart and logs a loud warning.

import { createHmac, randomBytes } from "node:crypto";
import { DEFAULT_ACCESS_TTL, DEFAULT_REFRESH_TTL } from "./jwt.js";
import type { JwtConfig } from "./types.js";

/** Minimum accepted secret length: 32 bytes of entropy hex-encoded is 64 chars. */
export const MIN_SECRET_LENGTH = 32;

/** Secrets that must never be accepted, even outside production. */
const FORBIDDEN_SECRETS = new Set([
  "secret",
  "changeme",
  "change-me",
  "jwt_secret",
  "jwt-secret",
  "development",
  "dev",
  "test",
  "password",
]);

export class JwtSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtSecretError";
  }
}

export interface ResolveJwtConfigOptions {
  /** Environment source; defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Warning sink; defaults to `console.warn`. */
  warn?: (message: string) => void;
}

function isProduction(env: Record<string, string | undefined>): boolean {
  return (env.NODE_ENV ?? "development") === "production";
}

function assertStrong(name: string, value: string): void {
  if (value.trim().length < MIN_SECRET_LENGTH) {
    throw new JwtSecretError(
      `${name} must be at least ${MIN_SECRET_LENGTH} characters. Generate one with: openssl rand -hex 32`,
    );
  }
  if (FORBIDDEN_SECRETS.has(value.trim().toLowerCase())) {
    throw new JwtSecretError(
      `${name} is a well-known placeholder value and must not be used. Generate one with: openssl rand -hex 32`,
    );
  }
}

/**
 * Derive the refresh secret from the access secret when only one is supplied.
 * JwtService requires the two to differ so a refresh token can never be
 * replayed as an access token even if the type claim were stripped.
 */
export function deriveRefreshSecret(accessSecret: string): string {
  return createHmac("sha256", accessSecret).update("zerosky:refresh").digest("hex");
}

/**
 * Build a JwtConfig from the environment.
 *
 * - production: `JWT_SECRET` is required and must be strong. No fallback.
 * - development/test: an ephemeral random secret is generated with a warning.
 */
export function resolveJwtConfig(opts: ResolveJwtConfigOptions = {}): JwtConfig {
  const env = opts.env ?? process.env;
  const warn = opts.warn ?? ((msg: string) => console.warn(msg));

  const rawAccess = env.JWT_SECRET?.trim();
  const rawRefresh = env.JWT_REFRESH_SECRET?.trim();

  let accessSecret: string;
  if (rawAccess) {
    assertStrong("JWT_SECRET", rawAccess);
    accessSecret = rawAccess;
  } else if (isProduction(env)) {
    throw new JwtSecretError(
      "JWT_SECRET is required in production and has no default. Generate one with: openssl rand -hex 32",
    );
  } else {
    accessSecret = randomBytes(32).toString("hex");
    warn(
      "[zerosky/auth] JWT_SECRET is not set: using an EPHEMERAL development secret. " +
        "All sessions are invalidated on restart and this must never happen in production. " +
        "Set JWT_SECRET (openssl rand -hex 32).",
    );
  }

  let refreshSecret: string;
  if (rawRefresh) {
    assertStrong("JWT_REFRESH_SECRET", rawRefresh);
    if (rawRefresh === accessSecret) {
      throw new JwtSecretError(
        "JWT_REFRESH_SECRET must differ from JWT_SECRET",
      );
    }
    refreshSecret = rawRefresh;
  } else {
    refreshSecret = deriveRefreshSecret(accessSecret);
  }

  const accessTtlSeconds = Number(env.JWT_ACCESS_TTL_SECONDS ?? DEFAULT_ACCESS_TTL);
  const refreshTtlSeconds = Number(env.JWT_REFRESH_TTL_SECONDS ?? DEFAULT_REFRESH_TTL);
  if (!Number.isFinite(accessTtlSeconds) || accessTtlSeconds <= 0) {
    throw new JwtSecretError("JWT_ACCESS_TTL_SECONDS must be a positive number");
  }
  if (!Number.isFinite(refreshTtlSeconds) || refreshTtlSeconds <= 0) {
    throw new JwtSecretError("JWT_REFRESH_TTL_SECONDS must be a positive number");
  }

  return {
    accessSecret,
    refreshSecret,
    accessTtlSeconds,
    refreshTtlSeconds,
    issuer: env.JWT_ISSUER ?? "zerosky",
  };
}
