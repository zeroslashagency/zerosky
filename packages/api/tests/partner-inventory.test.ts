// Tests for partner and inventory routers.
//
// Validates CRUD operations, tenant isolation, and business logic constraints
// for partnership and inventory management.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@zerosky/database";
import type { Tenant, User } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import type { AuthUser, Context } from "../src/context.js";
import {
  createCallerFactory,
  setRateLimiter,
  createInMemoryRateLimiter,
} from "../src/trpc.js";

const createCaller = createCallerFactory(appRouter);

let tenantA: Tenant;
let tenantB: Tenant;
let userA: User;
let userB: User;

const uniq = () => Math.random().toString(36).slice(2, 10);

/** Build a caller authenticated as the given user. */
function callerFor(user: User, forTenant: Tenant) {
  const auth: AuthUser = { user, tenant: forTenant };
  const ctx: Context = {
    db: prisma,
    auth,
    requestId: `req-${uniq()}`,
    clientId: `pi-${uniq()}`,
  };
  return createCaller(ctx);
}

beforeAll(async () => {
  setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));

  tenantA = await prisma.tenant.create({
    data: { name: "PI Tenant A", slug: `pi-a-${uniq()}` },
  });
  tenantB = await prisma.tenant.create({
    data: { name: "PI Tenant B", slug: `pi-b-${uniq()}` },
  });

  userA = await prisma.user.create({
    data: {
      tenantId: tenantA.id,
      email: `pi-a-${uniq()}@t.com`,
      passwordHash: "test-hash",
      name: "User A",
      role: "OWNER",
    },
  });
  userB = await prisma.user.create({
    data: {
      tenantId: tenantB.id,
      email: `pi-b-${uniq()}@t.com`,
      passwordHash: "test-hash",
      name: "User B",
      role: "OWNER",
    },
  });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({
    where: { id: { in: [tenantA.id, tenantB.id] } },
  });
  await prisma.$disconnect();
});

describe("partner router", () => {
  it("creates a partner with valid data", async () => {
    const caller = callerFor(userA, tenantA);
    const partner = await caller.partner.create({
      name: "Test Franchise",
      email: `partner-${uniq()}@test.com`,
      phone: "+1234567890",
      type: "FRANCHISE",
      revenueSharePercent: 15,
    });

    expect(partner.name).toBe("Test Franchise");
    expect(partner.type).toBe("FRANCHISE");
    expect(partner.revenueSharePercent).toBe(15);
  });

  it("rejects duplicate email", async () => {
    const caller = callerFor(userA, tenantA);
    const email = `dup-${uniq()}@test.com`;

    await caller.partner.create({
      name: "First Partner",
      email,
      type: "PARTNER",
      revenueSharePercent: 10,
    });

    await expect(
      caller.partner.create({
        name: "Second Partner",
        email,
        type: "PARTNER",
        revenueSharePercent: 10,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updates a partner", async () => {
    const caller = callerFor(userA, tenantA);
    const partner = await caller.partner.create({
      name: "Update Test",
      email: `update-${uniq()}@test.com`,
      type: "FRANCHISE",
      revenueSharePercent: 10,
    });

    const updated = await caller.partner.update({
      id: partner.id,
      name: "Updated Name",
      revenueSharePercent: 20,
    });

    expect(updated.name).toBe("Updated Name");
    expect(updated.revenueSharePercent).toBe(20);
  });

  it("deletes a partner without branches", async () => {
    const caller = callerFor(userA, tenantA);
    const partner = await caller.partner.create({
      name: "Delete Test",
      email: `delete-${uniq()}@test.com`,
      type: "INVESTOR",
      revenueSharePercent: 5,
    });

    await caller.partner.delete({ id: partner.id });

    await expect(caller.partner.get({ id: partner.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  // Note: Partner is a global entity without tenantId — partners can be shared
  // across tenants through BranchPartner associations. Tenant isolation happens
  // at the branch level, not at the partner level.
});

describe("inventory router", () => {
  it("creates an inventory item with valid data", async () => {
    const caller = callerFor(userA, tenantA);
    const item = await caller.inventory.create({
      tenantId: tenantA.id,
      name: "Coffee Beans",
      category: "Ingredients",
      unit: "kg",
      currentStock: 50,
      minStockLevel: 10,
      maxStockLevel: 100,
      unitCost: 250,
    });

    expect(item.name).toBe("Coffee Beans");
    expect(item.currentStock).toBe(50);
    expect(item.minStockLevel).toBe(10);
  });

  it("updates an inventory item", async () => {
    const caller = callerFor(userA, tenantA);
    const item = await caller.inventory.create({
      tenantId: tenantA.id,
      name: "Milk",
      category: "Ingredients",
      unit: "liters",
      currentStock: 20,
      minStockLevel: 5,
      unitCost: 60,
    });

    const updated = await caller.inventory.update({
      id: item.id,
      name: "Full Cream Milk",
      unitCost: 65,
    });

    expect(updated.name).toBe("Full Cream Milk");
    expect(updated.unitCost).toBe(65);
  });

  it("deletes an inventory item", async () => {
    const caller = callerFor(userA, tenantA);
    const item = await caller.inventory.create({
      tenantId: tenantA.id,
      name: "Delete Me",
      category: "Test",
      unit: "units",
      currentStock: 0,
      minStockLevel: 0,
      unitCost: 1,
    });

    await caller.inventory.delete({ id: item.id });

    await expect(caller.inventory.get({ id: item.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("adjusts stock correctly for IN operation", async () => {
    const caller = callerFor(userA, tenantA);
    const item = await caller.inventory.create({
      tenantId: tenantA.id,
      name: "Stock In Test",
      category: "Test",
      unit: "units",
      currentStock: 10,
      minStockLevel: 5,
      unitCost: 100,
    });

    await caller.inventory.adjustStock({
      inventoryItemId: item.id,
      tenantId: tenantA.id,
      type: "IN",
      quantity: 15,
      reason: "Stock received",
    });

    const updated = await caller.inventory.get({ id: item.id });
    expect(updated.currentStock).toBe(25);
  });

  it("adjusts stock correctly for OUT operation", async () => {
    const caller = callerFor(userA, tenantA);
    const item = await caller.inventory.create({
      tenantId: tenantA.id,
      name: "Stock Out Test",
      category: "Test",
      unit: "units",
      currentStock: 20,
      minStockLevel: 5,
      unitCost: 100,
    });

    await caller.inventory.adjustStock({
      inventoryItemId: item.id,
      tenantId: tenantA.id,
      type: "OUT",
      quantity: 8,
      reason: "Usage",
    });

    const updated = await caller.inventory.get({ id: item.id });
    expect(updated.currentStock).toBe(12);
  });

  it("rejects stock adjustment that would result in negative stock", async () => {
    const caller = callerFor(userA, tenantA);
    const item = await caller.inventory.create({
      tenantId: tenantA.id,
      name: "Negative Test",
      category: "Test",
      unit: "units",
      currentStock: 5,
      minStockLevel: 0,
      unitCost: 50,
    });

    await expect(
      caller.inventory.adjustStock({
        inventoryItemId: item.id,
        tenantId: tenantA.id,
        type: "OUT",
        quantity: 10,
        reason: "Too much",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("enforces tenant isolation on list", async () => {
    const callerA = callerFor(userA, tenantA);
    const callerB = callerFor(userB, tenantB);

    const itemA = await callerA.inventory.create({
      tenantId: tenantA.id,
      name: "Tenant A Item",
      category: "Test",
      unit: "units",
      currentStock: 10,
      minStockLevel: 5,
      unitCost: 100,
    });

    const listB = await callerB.inventory.list({ tenantId: tenantB.id });
    const idsB = listB.map((i) => i.id);

    expect(idsB).not.toContain(itemA.id);
  });

  it("enforces tenant isolation on get", async () => {
    const callerA = callerFor(userA, tenantA);
    const callerB = callerFor(userB, tenantB);

    const itemA = await callerA.inventory.create({
      tenantId: tenantA.id,
      name: "Isolated Item",
      category: "Test",
      unit: "units",
      currentStock: 10,
      minStockLevel: 5,
      unitCost: 100,
    });

    await expect(callerB.inventory.get({ id: itemA.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns low stock alerts correctly", async () => {
    const caller = callerFor(userA, tenantA);
    
    await caller.inventory.create({
      tenantId: tenantA.id,
      name: "Low Stock Item",
      category: "Test",
      unit: "units",
      currentStock: 3,
      minStockLevel: 10,
      unitCost: 50,
    });

    await caller.inventory.create({
      tenantId: tenantA.id,
      name: "Good Stock Item",
      category: "Test",
      unit: "units",
      currentStock: 50,
      minStockLevel: 10,
      unitCost: 50,
    });

    const alerts = await caller.inventory.lowStockAlerts({ tenantId: tenantA.id });
    const names = alerts.map((a) => a.name);

    expect(names).toContain("Low Stock Item");
    expect(names).not.toContain("Good Stock Item");
  });
});

// Regression: Prisma Decimal columns must cross the tRPC boundary as plain
// numbers. superjson has no serializer registered for Prisma's Decimal class,
// so anything that reaches the client as a Decimal arrives stripped of its
// methods. `/partners` crashed at render with
// "p.revenueSharePercent.toNumber is not a function" for exactly this reason.
//
// These tests assert the JSON-serialisable contract rather than calling
// Decimal methods, which is what let the original bug through: the earlier
// assertions ran server-side where the Decimal instance is still real.
describe("Decimal serialization across the API boundary", () => {
  it("returns partner.revenueSharePercent as a plain number from every procedure", async () => {
    const caller = callerFor(userA, tenantA);

    const created = await caller.partner.create({
      name: "Decimal Partner",
      email: `dec-${uniq()}@test.com`,
      type: "FRANCHISE",
      revenueSharePercent: 12.5,
    });
    expect(typeof created.revenueSharePercent).toBe("number");
    expect(created.revenueSharePercent).toBe(12.5);

    const fetched = await caller.partner.get({ id: created.id });
    expect(typeof fetched.revenueSharePercent).toBe("number");

    const listed = await caller.partner.list({});
    const mine = listed.find((p) => p.id === created.id);
    expect(typeof mine?.revenueSharePercent).toBe("number");

    const updated = await caller.partner.update({
      id: created.id,
      revenueSharePercent: 33.25,
    });
    expect(typeof updated.revenueSharePercent).toBe("number");
    expect(updated.revenueSharePercent).toBe(33.25);

    const removed = await caller.partner.delete({ id: created.id });
    expect(typeof removed.revenueSharePercent).toBe("number");
  });

  it("survives JSON round-tripping, which is what the browser actually receives", async () => {
    const caller = callerFor(userA, tenantA);
    const partners = await caller.partner.list({});
    const overTheWire = JSON.parse(JSON.stringify(partners));

    // The exact computation on /partners that used to throw.
    const average =
      overTheWire.reduce(
        (sum: number, p: { revenueSharePercent: number }) => sum + p.revenueSharePercent,
        0,
      ) / (overTheWire.length || 1);

    expect(Number.isFinite(average)).toBe(true);
  });

  it("returns every inventory Decimal column as a plain number", async () => {
    const caller = callerFor(userA, tenantA);

    const created = await caller.inventory.create({
      tenantId: tenantA.id,
      name: `Decimal Item ${uniq()}`,
      category: "Test",
      unit: "kg",
      currentStock: 7.5,
      minStockLevel: 2.25,
      maxStockLevel: 40,
      reorderPoint: 5,
      unitCost: 18.75,
    });

    for (const field of [
      "currentStock",
      "minStockLevel",
      "maxStockLevel",
      "reorderPoint",
      "unitCost",
    ] as const) {
      expect(typeof created[field]).toBe("number");
    }
    expect(created.currentStock).toBe(7.5);
    expect(created.unitCost).toBe(18.75);

    // The valuation maths on /inventory, over JSON as the browser sees it.
    const listed = JSON.parse(JSON.stringify(await caller.inventory.list({ tenantId: tenantA.id })));
    const valuation = listed.reduce(
      (sum: number, i: { currentStock: number; unitCost: number }) =>
        sum + i.currentStock * i.unitCost,
      0,
    );
    expect(Number.isFinite(valuation)).toBe(true);

    const fetched = await caller.inventory.get({ id: created.id });
    expect(typeof fetched.currentStock).toBe("number");

    const adjusted = await caller.inventory.adjustStock({
      inventoryItemId: created.id,
      tenantId: tenantA.id,
      type: "IN",
      quantity: 2.5,
    });
    expect(typeof adjusted.currentStock).toBe("number");
    expect(adjusted.currentStock).toBe(10);
  });

  it("keeps nullable Decimal columns as null rather than coercing them to 0", async () => {
    const caller = callerFor(userA, tenantA);
    const created = await caller.inventory.create({
      tenantId: tenantA.id,
      name: `Nullable Item ${uniq()}`,
      category: "Test",
      unit: "kg",
      currentStock: 1,
      minStockLevel: 1,
      unitCost: 1,
    });

    expect(created.maxStockLevel).toBeNull();
    expect(created.reorderPoint).toBeNull();
  });
});
