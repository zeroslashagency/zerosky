// Proves the day-gate wiring: `order.create` and `payment.record` stamp the
// open till's shiftId themselves, so shift reconciliation reflects real trading
// rather than rows a test patched by hand.
//
// This is the seam that makes the whole shift feature meaningful. Without it a
// cashier could open a till, trade all day, and close to a perfect ₹0 variance
// because no order or payment ever pointed at the shift.

import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@zerosky/database";
import type { Branch, Item, Tenant, User } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import type { AuthUser, Context } from "../src/context.js";
import {
  createCallerFactory,
  setRateLimiter,
  createInMemoryRateLimiter,
} from "../src/trpc.js";

const createCaller = createCallerFactory(appRouter);

let tenant: Tenant;
let branch: Branch;
let cashier: User;
let item: Item;

const uniq = () => Math.random().toString(36).slice(2, 10);

function callerFor(user: User) {
  const auth: AuthUser = { user, tenant };
  const ctx: Context = {
    db: prisma,
    auth,
    requestId: `req-${uniq()}`,
    clientId: `gate-${uniq()}`,
  };
  return createCaller(ctx);
}

beforeAll(async () => {
  setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));

  tenant = await prisma.tenant.create({
    data: { name: "Gate Tenant", slug: `gate-${uniq()}` },
  });
  branch = await prisma.branch.create({
    data: { tenantId: tenant.id, name: "Gate Main", code: `GTE-${uniq()}` },
  });
  cashier = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `gate-cashier-${uniq()}@t.com`,
      passwordHash: "irrelevant-for-these-tests",
      name: "Gate Cashier",
      role: "CASHIER",
    },
  });

  // Menu hangs off the tenant, not the branch.
  const menu = await prisma.menu.create({
    data: { tenantId: tenant.id, name: "Gate Menu" },
  });
  const category = await prisma.category.create({
    data: { menuId: menu.id, name: "Gate Cat" },
  });
  item = await prisma.item.create({
    data: {
      categoryId: category.id,
      name: "Gate Item",
      price: 100,
      taxRate: 5,
    },
  });
});

afterAll(async () => {
  await prisma.tenant.delete({ where: { id: tenant.id } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.payment.updateMany({
    where: { branchId: branch.id },
    data: { shiftId: null },
  });
  await prisma.order.updateMany({
    where: { branchId: branch.id },
    data: { shiftId: null },
  });
  await prisma.shift.deleteMany({ where: { branchId: branch.id } });
});

describe("day-gate: orders and payments attach to the open till", () => {
  it("stamps the open shift onto a new order without any manual patching", async () => {
    const caller = callerFor(cashier);
    const shift = await caller.shift.open({ branchId: branch.id, openingCash: 1000 });

    const order = await caller.order.create({
      branchId: branch.id,
      type: "TAKEAWAY",
      guestCount: 1,
      items: [{ itemId: item.id, quantity: 1 }],
    });

    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    expect(stored?.shiftId).toBe(shift.id);
  });

  it("stamps the open shift onto a payment, so the drawer maths sees it", async () => {
    const caller = callerFor(cashier);
    const shift = await caller.shift.open({ branchId: branch.id, openingCash: 1000 });

    const order = await caller.order.create({
      branchId: branch.id,
      type: "TAKEAWAY",
      guestCount: 1,
      items: [{ itemId: item.id, quantity: 1 }],
    });
    const payment = await caller.payment.record({
      orderId: order.id,
      method: "CASH",
      amount: Number(order.grandTotal),
      status: "CAPTURED",
    });

    const stored = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(stored?.shiftId).toBe(shift.id);
  });

  it("reaches a real closing variance end to end with no hand-written rows", async () => {
    const caller = callerFor(cashier);
    await caller.shift.open({ branchId: branch.id, openingCash: 1000 });

    // One ₹100 line at 5% GST settles for ₹105 in cash.
    const order = await caller.order.create({
      branchId: branch.id,
      type: "TAKEAWAY",
      guestCount: 1,
      items: [{ itemId: item.id, quantity: 1 }],
    });
    const due = Number(order.grandTotal);
    expect(due).toBe(105);

    await caller.payment.record({
      orderId: order.id,
      method: "CASH",
      amount: due,
      status: "CAPTURED",
    });

    // Drawer counted exactly: float 1000 + 105 cash = 1105, no variance.
    const closed = await caller.shift.close({
      branchId: branch.id,
      closingCash: 1105,
    });

    expect(closed.expectedCash).toBe(1105);
    expect(closed.closingCash).toBe(1105);
    expect(closed.variance).toBe(0);
  });

  it("shows a short drawer when cash is missing, proving the stamp is load-bearing", async () => {
    const caller = callerFor(cashier);
    await caller.shift.open({ branchId: branch.id, openingCash: 1000 });

    const order = await caller.order.create({
      branchId: branch.id,
      type: "TAKEAWAY",
      guestCount: 1,
      items: [{ itemId: item.id, quantity: 2 }],
    });
    await caller.payment.record({
      orderId: order.id,
      method: "CASH",
      amount: Number(order.grandTotal),
      status: "CAPTURED",
    });

    // ₹210 taken, but only ₹200 of it is in the drawer at close.
    const closed = await caller.shift.close({
      branchId: branch.id,
      closingCash: 1200,
    });

    expect(closed.expectedCash).toBe(1210);
    expect(closed.variance).toBe(-10);
  });

  it("leaves shiftId null when no till is open, so billing never blocks", async () => {
    const caller = callerFor(cashier);

    const order = await caller.order.create({
      branchId: branch.id,
      type: "TAKEAWAY",
      guestCount: 1,
      items: [{ itemId: item.id, quantity: 1 }],
    });
    const payment = await caller.payment.record({
      orderId: order.id,
      method: "CASH",
      amount: Number(order.grandTotal),
      status: "CAPTURED",
    });

    const storedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    const storedPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(storedOrder?.shiftId).toBeNull();
    expect(storedPayment?.shiftId).toBeNull();
    // And the order still settled, which is the point of not hard-gating.
    expect(storedOrder?.status).toBe("PAID");
  });

  it("excludes card and UPI takings from the drawer", async () => {
    const caller = callerFor(cashier);
    await caller.shift.open({ branchId: branch.id, openingCash: 500 });

    const order = await caller.order.create({
      branchId: branch.id,
      type: "TAKEAWAY",
      guestCount: 1,
      items: [{ itemId: item.id, quantity: 1 }],
    });
    await caller.payment.record({
      orderId: order.id,
      method: "UPI",
      amount: Number(order.grandTotal),
      status: "CAPTURED",
    });

    // UPI never touches the till, so only the float should be expected.
    const closed = await caller.shift.close({
      branchId: branch.id,
      closingCash: 500,
    });
    expect(closed.expectedCash).toBe(500);
    expect(closed.variance).toBe(0);
  });
});
