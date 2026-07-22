import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  assertExactRole,
  assertMinRole,
  hasExactRole,
  hasMinRole,
  roleRank,
} from "../src/rbac.js";

describe("rbac hierarchy", () => {
  it("ranks roles OWNER highest, KITCHEN lowest", () => {
    expect(roleRank("OWNER")).toBeGreaterThan(roleRank("MANAGER"));
    expect(roleRank("MANAGER")).toBeGreaterThan(roleRank("CASHIER"));
    expect(roleRank("CASHIER")).toBeGreaterThan(roleRank("WAITER"));
    expect(roleRank("WAITER")).toBeGreaterThan(roleRank("KITCHEN"));
  });

  it("hasMinRole is inclusive of equal rank", () => {
    expect(hasMinRole("MANAGER", "MANAGER")).toBe(true);
    expect(hasMinRole("OWNER", "CASHIER")).toBe(true);
    expect(hasMinRole("WAITER", "MANAGER")).toBe(false);
  });

  it("hasExactRole checks membership", () => {
    expect(hasExactRole("CASHIER", ["CASHIER", "MANAGER"])).toBe(true);
    expect(hasExactRole("WAITER", ["CASHIER", "MANAGER"])).toBe(false);
  });

  it("assertMinRole throws AuthorizationError when below", () => {
    expect(() => assertMinRole("KITCHEN", "MANAGER")).toThrow(AuthorizationError);
    expect(() => assertMinRole("OWNER", "MANAGER")).not.toThrow();
  });

  it("assertExactRole throws AuthorizationError when not allowed", () => {
    expect(() => assertExactRole("WAITER", ["OWNER"])).toThrow(AuthorizationError);
    expect(() => assertExactRole("OWNER", ["OWNER"])).not.toThrow();
  });
});
