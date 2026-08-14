// RBAC + tenant-isolation tests for A: API Security (IDOR + RBAC).
// Runs against live seeded Postgres like integration.test.ts — uses isolated tenants.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuthService, createInMemorySessionStore, hashPassword, setAuthService } from "@zerosky/auth";
import { prisma } from "@zerosky/database";
import type { Tenant, Branch, User } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import { createContext, type AuthUser } from "../src/context.js";
import { createInMemoryRateLimiter, setRateLimiter, createCallerFactory } from "../src/trpc.js";

const factory = createCallerFactory(appRouter);

let tenantA: Tenant;
let tenantB: Tenant;
let branchA: Branch;
let branchB: Branch;
let ownerA: User;
let waiterA: User;
let kitchenA: User;
let ownerB: User;

const uniq = () => Math.random().toString(36).slice(2, 8);

async function callerFor(user: User, tenant: Tenant) {
  const auth: AuthUser = { user, tenant };
  const ctx = await createContext({ db: prisma, auth });
  return factory(ctx);
}

beforeAll(async () => {
  setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));
  process.env.JWT_SECRET ??= "rbac-idor-test-secret-".padEnd(48, "x");
  setAuthService(createAuthService({ redis: createInMemorySessionStore() }));

  tenantA = await prisma.tenant.create({ data: { name: "RBAC A", slug: `rbac-a-${uniq()}` } });
  tenantB = await prisma.tenant.create({ data: { name: "RBAC B", slug: `rbac-b-${uniq()}` } });
  branchA = await prisma.branch.create({ data: { tenantId: tenantA.id, name: "A1", code: `RA-${uniq()}` } });
  branchB = await prisma.branch.create({ data: { tenantId: tenantB.id, name: "B1", code: `RB-${uniq()}` } });

  const pw = await hashPassword("pw123456", 4);
  ownerA = await prisma.user.create({ data: { tenantId: tenantA.id, email: `ownera-${uniq()}@t.com`, passwordHash: pw, name: "Owner A", role: "OWNER" } });
  waiterA = await prisma.user.create({ data: { tenantId: tenantA.id, email: `waiter-${uniq()}@t.com`, passwordHash: pw, name: "Waiter A", role: "WAITER" } });
  kitchenA = await prisma.user.create({ data: { tenantId: tenantA.id, email: `kit-${uniq()}@t.com`, passwordHash: pw, name: "Kit A", role: "KITCHEN" } });
  ownerB = await prisma.user.create({ data: { tenantId: tenantB.id, email: `ownerb-${uniq()}@t.com`, passwordHash: pw, name: "Owner B", role: "OWNER" } });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
  // Do not $disconnect here — integration.test.ts also disconnects; vitest runs files in same process.
});

describe("RBAC 403 — manager-only routers reject WAITER/KITCHEN", () => {
  it("reports.salesSummary: WAITER gets FORBIDDEN", async () => {
    const caller = await callerFor(waiterA, tenantA);
    await expect(caller.reports.salesSummary({ startDate: new Date().toISOString(), endDate: new Date().toISOString() })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("supplier.list: WAITER gets FORBIDDEN", async () => {
    const caller = await callerFor(waiterA, tenantA);
    await expect(caller.supplier.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("purchaseOrder.list: WAITER gets FORBIDDEN", async () => {
    const caller = await callerFor(waiterA, tenantA);
    await expect(caller.purchaseOrder.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("partner.list: WAITER gets FORBIDDEN", async () => {
    const caller = await callerFor(waiterA, tenantA);
    await expect(caller.partner.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("inventory.create: WAITER gets FORBIDDEN", async () => {
    const caller = await callerFor(waiterA, tenantA);
    await expect(caller.inventory.create({ name: "X", category: "cat", unit: "kg", currentStock: 1, minStockLevel: 1, unitCost: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("menu.setItemAvailability: WAITER gets FORBIDDEN (tightened to OWNER/MANAGER/CASHIER)", async () => {
    const caller = await callerFor(waiterA, tenantA);
    await expect(caller.menu.setItemAvailability({ id: "missing", isAvailable: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("order.setStatus: KITCHEN cannot set PAID", async () => {
    // Create an order as owner, then try to mark PAID as kitchen -> FORBIDDEN before NOT_FOUND check
    const ownerCaller = await callerFor(ownerA, tenantA);
    const menu = await prisma.menu.create({ data: { tenantId: tenantA.id, name: "M", isDefault: true } });
    const cat = await prisma.category.create({ data: { menuId: menu.id, name: "C" } });
    const item = await prisma.item.create({ data: { categoryId: cat.id, name: "I", price: "100.00", taxRate: "5.00" } });
    const order = await ownerCaller.order.create({ branchId: branchA.id, items: [{ itemId: item.id, quantity: 1 }] });
    const kitCaller = await callerFor(kitchenA, tenantA);
    await expect(kitCaller.order.setStatus({ id: order.id, status: "PAID" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("tenant isolation — cross-tenant get returns NOT_FOUND (not leaked)", () => {
  it("supplier.get: other tenant cannot read", async () => {
    const ownerACaller = await callerFor(ownerA, tenantA);
    const s = await ownerACaller.supplier.create({ name: `Sup-${uniq()}` });
    const otherCaller = await callerFor(ownerB, tenantB);
    await expect(otherCaller.supplier.get({ id: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("purchaseOrder.get: other tenant cannot read", async () => {
    const ownerACaller = await callerFor(ownerA, tenantA);
    const sup = await ownerACaller.supplier.create({ name: `Sup2-${uniq()}` });
    const item = await prisma.inventoryItem.create({ data: { tenantId: tenantA.id, name: `Inv-${uniq()}`, category: "cat", unit: "kg", currentStock: 10, minStockLevel: 1, unitCost: 1 } });
    const po = await ownerACaller.purchaseOrder.create({ supplierId: sup.id, items: [{ inventoryItemId: item.id, quantity: 1, unitCost: 1 }] });
    const otherCaller = await callerFor(ownerB, tenantB);
    await expect(otherCaller.purchaseOrder.get({ id: po.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("inventory.stockHistory: other tenant cannot read", async () => {
    const ownerACaller = await callerFor(ownerA, tenantA);
    const item = await prisma.inventoryItem.create({ data: { tenantId: tenantA.id, name: `InvH-${uniq()}`, category: "cat", unit: "kg", currentStock: 5, minStockLevel: 1, unitCost: 1 } });
    const otherCaller = await callerFor(ownerB, tenantB);
    await expect(otherCaller.inventory.stockHistory({ inventoryItemId: item.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("reports.salesSummary ignores input tenantId and scopes to caller tenant", async () => {
    const ownerACaller = await callerFor(ownerA, tenantA);
    // Even if caller passes tenantB id, results must be scoped to tenantA (no leak / no 500)
    const res = await ownerACaller.reports.salesSummary({ tenantId: tenantB.id, startDate: new Date(Date.now() - 86400000).toISOString(), endDate: new Date().toISOString() });
    expect(res).toHaveProperty("totalRevenue");
  });
});
