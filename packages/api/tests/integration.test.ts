// Integration tests for @zerosky/api against the live seeded PostgreSQL DB.
// Each suite creates its own isolated tenant so runs are repeatable.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAuthService,
  createInMemorySessionStore,
  hashPassword,
  hashPin,
  setAuthService,
} from "@zerosky/auth";
import { prisma } from "@zerosky/database";
import type { Tenant, Branch, User, Item } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import { createContext, type AuthUser } from "../src/context.js";
import { createCallerFactory, setRateLimiter, createInMemoryRateLimiter } from "../src/trpc.js";

const createCaller = createCallerFactory(appRouter);

let tenant: Tenant;
let otherTenant: Tenant;
let branch: Branch;
let owner: User;
let waiter: User;
let kitchen: User;
let item: Item;

/** Plaintext password for test users; stored as a real bcrypt hash. */
const TEST_PASSWORD = "test-password-123";
let testPasswordHash: string;

const uniq = () => Math.random().toString(36).slice(2, 10);

async function callerFor(user: User, tenantRow: Tenant) {
  const auth: AuthUser = { user, tenant: tenantRow };
  const ctx = await createContext({ db: prisma, auth });
  return createCaller(ctx);
}

async function publicCaller() {
  const ctx = await createContext({ db: prisma, auth: null });
  return createCaller(ctx);
}

beforeAll(async () => {
  // Generous limit so the suite itself is never rate-limited.
  setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));
  // Deterministic secret + in-memory session store: no Redis needed here.
  process.env.JWT_SECRET ??= "integration-test-secret-".padEnd(48, "x");
  setAuthService(createAuthService({ redis: createInMemorySessionStore() }));

  tenant = await prisma.tenant.create({
    data: { name: "IT Tenant", slug: `it-${uniq()}` },
  });
  otherTenant = await prisma.tenant.create({
    data: { name: "Other Tenant", slug: `other-${uniq()}` },
  });
  branch = await prisma.branch.create({
    data: { tenantId: tenant.id, name: "Main", code: `B-${uniq()}` },
  });
  // Real bcrypt hash (low rounds for speed) so auth.login can authenticate.
  testPasswordHash = await hashPassword(TEST_PASSWORD, 4);
  owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `owner-${uniq()}@t.com`,
      passwordHash: testPasswordHash,
      name: "Owner",
      role: "OWNER",
      // PINs are stored hashed; pinLogin bcrypt-compares candidates.
      pinHash: await hashPin("1111"),
    },
  });
  waiter = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `waiter-${uniq()}@t.com`,
      passwordHash: testPasswordHash,
      name: "Waiter",
      role: "WAITER",
    },
  });
  kitchen = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `kitchen-${uniq()}@t.com`,
      passwordHash: testPasswordHash,
      name: "Kitchen",
      role: "KITCHEN",
    },
  });
  const menu = await prisma.menu.create({
    data: { tenantId: tenant.id, name: "Main Menu", isDefault: true },
  });
  const category = await prisma.category.create({
    data: { menuId: menu.id, name: "Mains" },
  });
  item = await prisma.item.create({
    data: {
      categoryId: category.id,
      name: "Paneer Tikka",
      price: "200.00",
      taxRate: "5.00",
    },
  });
});

afterAll(async () => {
  // Cascade deletes children (branches, users, menus → orders, kots, payments).
  await prisma.tenant.deleteMany({
    where: { id: { in: [tenant.id, otherTenant.id] } },
  });
  await prisma.$disconnect();
});

describe("auth router", () => {
  it("login succeeds for a valid tenant + user", async () => {
    const caller = await publicCaller();
    const res = await caller.auth.login({
      email: owner.email,
      password: TEST_PASSWORD,
      tenantSlug: tenant.slug,
    });
    // The token is a signed JWT, NOT the user id (that was the vulnerability).
    expect(res.token).not.toBe(owner.id);
    expect(res.token.split(".")).toHaveLength(3);
    expect(res.refreshToken.split(".")).toHaveLength(3);
    expect(res.user.role).toBe("OWNER");
  });

  it("login rejects an incorrect password", async () => {
    const caller = await publicCaller();
    await expect(
      caller.auth.login({
        email: owner.email,
        password: "wrong-password",
        tenantSlug: tenant.slug,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("login rejects unknown tenant", async () => {
    const caller = await publicCaller();
    await expect(
      caller.auth.login({
        email: owner.email,
        password: "x",
        tenantSlug: "does-not-exist",
      }),
    ).rejects.toThrow(/Invalid tenant/);
  });

  it("pinLogin succeeds by pin", async () => {
    const caller = await publicCaller();
    const res = await caller.auth.pinLogin({
      pin: "1111",
      tenantSlug: tenant.slug,
    });
    expect(res.user.id).toBe(owner.id);
    expect(res.token).not.toBe(owner.id);
  });

  it("pinLogin rejects a wrong pin against the hashed column", async () => {
    const caller = await publicCaller();
    await expect(
      caller.auth.pinLogin({ pin: "9999", tenantSlug: tenant.slug }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("me requires authentication", async () => {
    const caller = await publicCaller();
    await expect(caller.auth.me()).rejects.toThrow(/Authentication required/);
  });

  it("me returns the authenticated principal", async () => {
    const caller = await callerFor(owner, tenant);
    const res = await caller.auth.me();
    expect(res.user.id).toBe(owner.id);
    expect(res.tenant.slug).toBe(tenant.slug);
  });
});

describe("menu router", () => {
  it("lists menus scoped to the tenant with nested categories + items", async () => {
    const caller = await callerFor(owner, tenant);
    const menus = await caller.menu.list({ includeInactive: false });
    expect(menus.length).toBeGreaterThan(0);
    expect(menus[0]?.categories[0]?.items[0]?.name).toBe("Paneer Tikka");
  });

  it("allows admins to create a menu but forbids waiters", async () => {
    const admin = await callerFor(owner, tenant);
    const created = await admin.menu.createMenu({ name: "Bar", isDefault: false });
    expect(created.name).toBe("Bar");

    const waiterCaller = await callerFor(waiter, tenant);
    await expect(
      waiterCaller.menu.createMenu({ name: "Nope", isDefault: false }),
    ).rejects.toThrow(/Requires one of roles/);
  });

  it("getItem returns 404 for another tenant's item", async () => {
    const caller = await callerFor(owner, otherTenant);
    await expect(caller.menu.getItem({ id: item.id })).rejects.toThrow(
      /not found/i,
    );
  });
});

describe("order + kot + payment flow", () => {
  it("creates an order with computed totals, sends KOT, and records payment", async () => {
    const caller = await callerFor(waiter, tenant);

    const order = await caller.order.create({
      branchId: branch.id,
      type: "DINE_IN",
      guestCount: 2,
      items: [{ itemId: item.id, quantity: 2 }],
    });
    // 2 * 200 = 400 net, 5% tax = 20, grand = 420
    expect(Number(order.subtotal)).toBe(400);
    expect(Number(order.taxTotal)).toBe(20);
    expect(Number(order.grandTotal)).toBe(420);
    expect(order.items).toHaveLength(1);

    const kot = await caller.kot.generate({ orderId: order.id });
    expect(kot.status).toBe("NEW");
    expect(kot.items).toHaveLength(1);

    // Generating again with no pending items should fail.
    await expect(caller.kot.generate({ orderId: order.id })).rejects.toThrow(
      /No pending items/,
    );

    const kitchenCaller = await callerFor(kitchen, tenant);
    const ready = await kitchenCaller.kot.setStatus({
      id: kot.id,
      status: "READY",
    });
    expect(ready.status).toBe("READY");

    const printed = await caller.kot.markPrinted({ id: kot.id });
    expect(printed.printedAt).not.toBeNull();

    const cashier = await callerFor(owner, tenant);
    const payment = await cashier.payment.record({
      orderId: order.id,
      method: "UPI",
      amount: 420,
      reference: "upi-ref-1",
    });
    expect(payment.status).toBe("CAPTURED");

    const refunded = await cashier.payment.refund({ id: payment.id });
    expect(refunded.status).toBe("REFUNDED");

    const paid = await cashier.order.setStatus({ id: order.id, status: "PAID" });
    expect(paid.status).toBe("PAID");

    // Cannot cancel a paid order.
    await expect(
      cashier.order.cancel({ id: order.id, reason: "test" }),
    ).rejects.toThrow(/Cannot cancel a paid order/);
  });

  it("rejects order creation with an item from another tenant", async () => {
    const caller = await callerFor(owner, otherTenant);
    await expect(
      caller.order.create({
        branchId: branch.id,
        items: [{ itemId: item.id, quantity: 1 }],
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("lists orders for a branch", async () => {
    const caller = await callerFor(owner, tenant);
    const orders = await caller.order.list({ branchId: branch.id });
    expect(orders.length).toBeGreaterThan(0);
  });
});

describe("table router", () => {
  it("creates, lists, updates, and transitions a table", async () => {
    const admin = await callerFor(owner, tenant);
    const table = await admin.table.create({
      branchId: branch.id,
      name: `T-${uniq()}`,
      seats: 4,
    });
    expect(table.state).toBe("AVAILABLE");

    const updated = await admin.table.update({ id: table.id, seats: 6 });
    expect(updated.seats).toBe(6);

    const waiterCaller = await callerFor(waiter, tenant);
    const occupied = await waiterCaller.table.setState({
      id: table.id,
      state: "OCCUPIED",
    });
    expect(occupied.state).toBe("OCCUPIED");

    const list = await admin.table.list({ branchId: branch.id });
    expect(list.some((t) => t.id === table.id)).toBe(true);
  });

  it("forbids waiters from creating tables", async () => {
    const waiterCaller = await callerFor(waiter, tenant);
    await expect(
      waiterCaller.table.create({ branchId: branch.id, name: "X" }),
    ).rejects.toThrow(/Requires one of roles/);
  });

  it("rejects table ops against a branch from another tenant", async () => {
    const other = await callerFor(owner, otherTenant);
    await expect(
      other.table.list({ branchId: branch.id }),
    ).rejects.toThrow(/Branch not found/);
    await expect(
      other.table.create({ branchId: branch.id, name: "Nope" }),
    ).rejects.toThrow(/Branch not found/);
    await expect(
      other.table.update({ id: "missing-id", seats: 2 }),
    ).rejects.toThrow(/Table not found/);
    await expect(
      other.table.setState({ id: "missing-id", state: "OCCUPIED" }),
    ).rejects.toThrow(/Table not found/);
  });
});

describe("menu router edge cases", () => {
  it("creates an item under a valid category and rejects unknown categories", async () => {
    const admin = await callerFor(owner, tenant);
    const menu = await admin.menu.createMenu({ name: "Specials", isDefault: false });
    const category = await prisma.category.create({
      data: { menuId: menu.id, name: "Sides" },
    });
    const created = await admin.menu.createItem({
      categoryId: category.id,
      name: "Fries",
      price: 120,
      taxRate: 5,
    });
    expect(created.name).toBe("Fries");

    // Toggle availability, then confirm.
    const toggled = await admin.menu.setItemAvailability({
      id: created.id,
      isAvailable: false,
    });
    expect(toggled.isAvailable).toBe(false);

    await expect(
      admin.menu.createItem({ categoryId: "missing", name: "X", price: 1 }),
    ).rejects.toThrow(/Category not found/);
    await expect(
      admin.menu.setItemAvailability({ id: "missing", isAvailable: true }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("order + payment edge cases", () => {
  it("adds items to an open order and lists payments; guards refund/cancel rules", async () => {
    const admin = await callerFor(owner, tenant);
    const order = await admin.order.create({
      branchId: branch.id,
      items: [{ itemId: item.id, quantity: 1 }],
    });
    expect(Number(order.grandTotal)).toBe(210);

    const withMore = await admin.order.addItems({
      orderId: order.id,
      items: [{ itemId: item.id, quantity: 1 }],
    });
    expect(Number(withMore.grandTotal)).toBe(420);

    // A pending (non-captured) payment cannot be refunded.
    const pending = await admin.payment.record({
      orderId: order.id,
      method: "CASH",
      amount: 420,
      status: "PENDING",
    });
    await expect(admin.payment.refund({ id: pending.id })).rejects.toThrow(
      /Only captured payments/,
    );
    const captured = await admin.payment.setStatus({
      id: pending.id,
      status: "CAPTURED",
    });
    expect(captured.status).toBe("CAPTURED");

    const payments = await admin.payment.list({ orderId: order.id });
    expect(payments.length).toBeGreaterThan(0);

    // Unknown ids / cross-tenant lookups map to NOT_FOUND.
    const other = await callerFor(owner, otherTenant);
    await expect(
      other.payment.record({ orderId: order.id, method: "CASH", amount: 1 }),
    ).rejects.toThrow(/Order not found/);
    await expect(other.payment.refund({ id: pending.id })).rejects.toThrow(
      /Payment not found/,
    );
    await expect(
      other.payment.setStatus({ id: pending.id, status: "FAILED" }),
    ).rejects.toThrow(/Payment not found/);

    // Cancel an unpaid order, then confirm terminal-state guards.
    const cancelled = await admin.order.cancel({ id: order.id, reason: "x" });
    expect(cancelled.status).toBe("CANCELLED");
    await expect(
      admin.order.setStatus({ id: order.id, status: "PAID" }),
    ).rejects.toThrow(/cancelled order/);
    await expect(
      admin.payment.record({ orderId: order.id, method: "CASH", amount: 1 }),
    ).rejects.toThrow(/cancelled order/);
  });

  it("returns NOT_FOUND for order/kot lookups across tenants", async () => {
    const other = await callerFor(owner, otherTenant);
    await expect(
      other.order.addItems({ orderId: "missing", items: [{ itemId: item.id, quantity: 1 }] }),
    ).rejects.toThrow(/Order not found/);
    await expect(other.order.setStatus({ id: "missing", status: "PAID" })).rejects.toThrow(
      /Order not found/,
    );
    await expect(other.order.cancel({ id: "missing" })).rejects.toThrow(/Order not found/);
    await expect(other.kot.generate({ orderId: "missing" })).rejects.toThrow(/Order not found/);
    await expect(other.kot.setStatus({ id: "missing", status: "READY" })).rejects.toThrow(
      /KOT not found/,
    );
    await expect(other.kot.markPrinted({ id: "missing" })).rejects.toThrow(/KOT not found/);
  });

  it("lists kots filtered by branch", async () => {
    const admin = await callerFor(owner, tenant);
    const kots = await admin.kot.list({ branchId: branch.id });
    expect(Array.isArray(kots)).toBe(true);
  });
});
