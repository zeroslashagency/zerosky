import { describe, expect, it } from "vitest";
import { AuthContext, TenantMismatchError } from "../src/context.js";
import { AuthorizationError } from "../src/rbac.js";

function ctx(role: "OWNER" | "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN") {
  return new AuthContext({ id: "u1", tenantId: "t1", role });
}

describe("AuthContext", () => {
  it("exposes user fields", () => {
    const c = ctx("MANAGER");
    expect(c.userId).toBe("u1");
    expect(c.tenantId).toBe("t1");
    expect(c.role).toBe("MANAGER");
    expect(c.isOwner()).toBe(false);
    expect(ctx("OWNER").isOwner()).toBe(true);
  });

  it("assertTenant passes for matching tenant and throws otherwise", () => {
    const c = ctx("CASHIER");
    expect(() => c.assertTenant("t1")).not.toThrow();
    expect(() => c.assertTenant("t2")).toThrow(TenantMismatchError);
  });

  it("assertMinRole enforces the hierarchy", () => {
    expect(() => ctx("OWNER").assertMinRole("MANAGER")).not.toThrow();
    expect(() => ctx("WAITER").assertMinRole("MANAGER")).toThrow(
      AuthorizationError,
    );
  });
});
