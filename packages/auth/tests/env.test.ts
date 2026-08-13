// Tests for JWT secret resolution.
//
// The rule being enforced: production NEVER falls back to a default secret. A
// hardcoded fallback would mean every deployment that forgot to set JWT_SECRET
// shares a publicly-known signing key, which is equivalent to no signature.

import { describe, expect, it, vi } from "vitest";
import {
  JwtSecretError,
  MIN_SECRET_LENGTH,
  deriveRefreshSecret,
  resolveJwtConfig,
} from "../src/env.js";

const STRONG = "a".repeat(MIN_SECRET_LENGTH);
const OTHER_STRONG = "b".repeat(MIN_SECRET_LENGTH);

describe("resolveJwtConfig", () => {
  it("fails loudly in production when JWT_SECRET is missing", () => {
    expect(() =>
      resolveJwtConfig({ env: { NODE_ENV: "production" }, warn: () => {} }),
    ).toThrow(JwtSecretError);
    expect(() =>
      resolveJwtConfig({ env: { NODE_ENV: "production" }, warn: () => {} }),
    ).toThrow(/JWT_SECRET is required in production/);
  });

  it("rejects a too-short secret", () => {
    expect(() =>
      resolveJwtConfig({
        env: { NODE_ENV: "production", JWT_SECRET: "short" },
        warn: () => {},
      }),
    ).toThrow(/at least 32 characters/);
  });

  it("rejects well-known placeholder secrets even outside production", () => {
    expect(() =>
      resolveJwtConfig({
        env: { NODE_ENV: "development", JWT_SECRET: "changeme" },
        warn: () => {},
      }),
    ).toThrow(JwtSecretError);
  });

  it("accepts a strong production secret and derives a distinct refresh secret", () => {
    const config = resolveJwtConfig({
      env: { NODE_ENV: "production", JWT_SECRET: STRONG },
      warn: () => {},
    });
    expect(config.accessSecret).toBe(STRONG);
    expect(config.refreshSecret).not.toBe(STRONG);
    expect(config.refreshSecret).toBe(deriveRefreshSecret(STRONG));
  });

  it("honours an explicit refresh secret and rejects a duplicate one", () => {
    const config = resolveJwtConfig({
      env: {
        NODE_ENV: "production",
        JWT_SECRET: STRONG,
        JWT_REFRESH_SECRET: OTHER_STRONG,
      },
      warn: () => {},
    });
    expect(config.refreshSecret).toBe(OTHER_STRONG);

    expect(() =>
      resolveJwtConfig({
        env: {
          NODE_ENV: "production",
          JWT_SECRET: STRONG,
          JWT_REFRESH_SECRET: STRONG,
        },
        warn: () => {},
      }),
    ).toThrow(/must differ/);
  });

  it("generates an ephemeral dev secret and warns about it", () => {
    const warn = vi.fn();
    const first = resolveJwtConfig({ env: { NODE_ENV: "development" }, warn });
    const second = resolveJwtConfig({ env: { NODE_ENV: "development" }, warn });

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]![0]).toMatch(/EPHEMERAL development secret/);
    // Ephemeral means "different every time", so sessions cannot survive.
    expect(first.accessSecret).not.toBe(second.accessSecret);
    expect(first.accessSecret.length).toBeGreaterThanOrEqual(MIN_SECRET_LENGTH);
  });

  it("rejects non-numeric TTL overrides", () => {
    expect(() =>
      resolveJwtConfig({
        env: { JWT_SECRET: STRONG, JWT_ACCESS_TTL_SECONDS: "soon" },
        warn: () => {},
      }),
    ).toThrow(/JWT_ACCESS_TTL_SECONDS/);
    expect(() =>
      resolveJwtConfig({
        env: { JWT_SECRET: STRONG, JWT_REFRESH_TTL_SECONDS: "-1" },
        warn: () => {},
      }),
    ).toThrow(/JWT_REFRESH_TTL_SECONDS/);
  });

  it("defaults TTLs to 15 minutes / 7 days", () => {
    const config = resolveJwtConfig({
      env: { JWT_SECRET: STRONG },
      warn: () => {},
    });
    expect(config.accessTtlSeconds).toBe(900);
    expect(config.refreshTtlSeconds).toBe(604800);
    expect(config.issuer).toBe("zerosky");
  });
});
