// Tests for the shift/till lifecycle: open, close, variance, and the guard that
// stops a cashier closing a drawer with live orders still on it.
//
// Most of these tests stamp shiftId directly so the arithmetic under test is
// isolated from order creation. `order.create` and `payment.record` now stamp it
// themselves via `resolveOpenShift` — see day-gate.test.ts, which proves that
// wiring end to end through the real procedures.

import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@zerosky/database";
import type { Branch, Item, Tenant, User } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import { resolveOpenShift } from "../src/routers/shift.js";
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
let manager: User;
let item: Item;

const uniq = () => Math.random().toString(36).slice(2, 10);

function callerFor(user: User) {
  const auth: AuthUser = { user, tenant };
  const ctx: Context = {
    db: prisma,
    auth,
    requestId: `req-${uniq()}`,
    clientId: `shift-${uniq()}`,
  };
  return createCaller(ctx);
}

/** Order with a single line of the seeded item, attached to the open shift. */
async function createOrderOnShift(shiftId: string | null) {
  const order = await callerFor(cashier).order.create({
    branchId: branch.id,
    type: "TAKEAWAY",
    guestCount: 1,
    items: [{ itemId: item.id, quantity: 1 }],
  });
  // `order.create` stamps the open till itself, so shiftId=null must actively
  // clear it to model an order that belongs to no shift.
  await prisma.order.update({
    where: { id: order.id },
    data: { shiftId: shiftId ?? null },
  });
  return order;
}

/** Captured payment on `order`, attached to the shift like payment.record will. */
async function payOnShift(
  orderId: string,
  shiftId: string | null,
  method: "CASH" | "CARD" | "UPI",
  amount: number,
  status: "CAPTURED" | "PENDING" | "REFUNDED" = "CAPTURED",
) {
  const payment = await callerFor(cashier).payment.record({
    orderId,
    method,
    amount,
    status: status === "REFUNDED" ? "CAPTURED" : status,
  });
  // `payment.record` now stamps the open till itself, so passing shiftId=null
  // must actively clear it — otherwise a payment this test wants EXCLUDED from
  // the shift silently gets included, and expectedCash comes out too high.
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      shiftId: shiftId ?? null,
      ...(status === "REFUNDED" ? { status: "REFUNDED" as const } : {}),
    },
  });
  return payment;
}

/** Wipe any shift state so each test starts from a closed till. */
async function resetShifts() {
  await prisma.payment.updateMany({
    where: { branchId: branch.id },
    data: { shiftId: null },
  });
  await prisma.order.updateMany({
    where: { branchId: branch.id },
    data: { shiftId: null },
  });
  await prisma.shift.deleteMany({ where: { branchId: branch.id } });
}

beforeAll(async () => {
  setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));

  tenant = await prisma.tenant.create({
    data: { name: "Shift Tenant", slug: `shift-${uniq()}` },
  });
  branch = await prisma.branch.create({
    data: { tenantId: tenant.id, name: "Shift Main", code: `SFT-${uniq()}` },
  });
  cashier = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `shift-cashier-${uniq()}@t.com`,
      passwordHash: "irrelevant-for-these-tests",
      name: "Shift Cashier",
      role: "CASHIER",
    },
  });
  manager = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `shift-manager-${uniq()}@t.com`,
      passwordHash: "irrelevant-for-these-tests",
      name: "Shift Manager",
      role: "MANAGER",
    },
  });

  // Menu hangs off the tenant, not the branch.
  const menu = await prisma.menu.create({
    data: { tenantId: tenant.id, name: "Shift Menu" },
  });
  const category = await prisma.category.create({
    data: { menuId: menu.id, name: "Shift Cat" },
  });
  item = await prisma.item.create({
    data: {
      categoryId: category.id,
      name: "Shift Item",
      price: 100,
      taxRate: 0, // keeps hand-computed totals exact: grandTotal === 100
    },
  });
});

afterAll(async () => {
  await prisma.tenant.delete({ where: { id: tenant.id } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetShifts();
});

describe("shift.open", () => {
  it("records the opening float and the user who opened the till", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 2000,
    });

    expect(shift.status).toBe("OPEN");
    expect(shift.openingCash).toBe(2000);
    expect(shift.openedById).toBe(cashier.id);
    expect(shift.closedAt).toBeNull();
    // Money must cross the wire as a plain number, not a Decimal instance.
    expect(typeof shift.openingCash).toBe("number");
  });

  it("rejects a second open shift for the same branch", async () => {
    await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 1000,
    });

    await expect(
      callerFor(manager).shift.open({
        branchId: branch.id,
        openingCash: 500,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await prisma.shift.count({ where: { branchId: branch.id } })).toBe(1);
  });

  it("only lets one of two simultaneous opens win", async () => {
    const results = await Promise.allSettled([
      callerFor(cashier).shift.open({ branchId: branch.id, openingCash: 1000 }),
      callerFor(manager).shift.open({ branchId: branch.id, openingCash: 1500 }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    expect(
      await prisma.shift.count({ where: { branchId: branch.id, status: "OPEN" } }),
    ).toBe(1);
  });

  it("reopens once the previous shift is closed", async () => {
    await callerFor(cashier).shift.open({ branchId: branch.id, openingCash: 500 });
    await callerFor(cashier).shift.close({ branchId: branch.id, closingCash: 500 });

    const second = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 800,
    });
    expect(second.status).toBe("OPEN");
  });

  it("refuses a branch belonging to another tenant", async () => {
    const other = await prisma.tenant.create({
      data: { name: "Other Tenant", slug: `other-${uniq()}` },
    });
    const otherBranch = await prisma.branch.create({
      data: { tenantId: other.id, name: "Other Main", code: `OTH-${uniq()}` },
    });

    await expect(
      callerFor(cashier).shift.open({
        branchId: otherBranch.id,
        openingCash: 100,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await prisma.tenant.delete({ where: { id: other.id } });
  });
});

describe("shift.current", () => {
  it("returns null when no till is open", async () => {
    expect(
      await callerFor(cashier).shift.current({ branchId: branch.id }),
    ).toBeNull();
  });

  it("returns the open shift with the opener attached", async () => {
    const opened = await callerFor(manager).shift.open({
      branchId: branch.id,
      openingCash: 1200,
    });

    const current = await callerFor(cashier).shift.current({
      branchId: branch.id,
    });
    expect(current?.id).toBe(opened.id);
    expect(current?.openingCash).toBe(1200);
    expect(current?.openedBy.name).toBe(manager.name);
  });

  it("returns null again once the shift is closed", async () => {
    await callerFor(cashier).shift.open({ branchId: branch.id, openingCash: 100 });
    await callerFor(cashier).shift.close({ branchId: branch.id, closingCash: 100 });

    expect(
      await callerFor(cashier).shift.current({ branchId: branch.id }),
    ).toBeNull();
  });
});

describe("shift.close expectedCash", () => {
  it("sums only captured cash payments belonging to the shift", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 1000,
    });

    // 2 x ₹100 cash on this shift → expected 1000 + 200 = 1200.
    const a = await createOrderOnShift(shift.id);
    await payOnShift(a.id, shift.id, "CASH", 100);
    const b = await createOrderOnShift(shift.id);
    await payOnShift(b.id, shift.id, "CASH", 100);

    // Card money never touches the drawer.
    const c = await createOrderOnShift(shift.id);
    await payOnShift(c.id, shift.id, "CARD", 100);

    // Cash on an order that is not on this shift must not count.
    const outside = await createOrderOnShift(null);
    await payOnShift(outside.id, null, "CASH", 100);

    const closed = await callerFor(cashier).shift.close({
      branchId: branch.id,
      closingCash: 1200,
    });

    expect(closed.expectedCash).toBe(1200);
    expect(closed.variance).toBe(0);
    expect(closed.status).toBe("CLOSED");
    expect(closed.closedById).toBe(cashier.id);
  });

  it("subtracts cash refunds from the expected drawer", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 500,
    });

    const paid = await createOrderOnShift(shift.id);
    await payOnShift(paid.id, shift.id, "CASH", 100);
    const refunded = await createOrderOnShift(shift.id);
    await payOnShift(refunded.id, shift.id, "CASH", 100, "REFUNDED");

    // 500 + 100 captured - 100 refunded = 500.
    const closed = await callerFor(cashier).shift.close({
      branchId: branch.id,
      closingCash: 500,
    });
    expect(closed.expectedCash).toBe(500);
    expect(closed.variance).toBe(0);
  });

  it("ignores pending cash that was never captured", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 300,
    });
    const order = await createOrderOnShift(shift.id);
    await payOnShift(order.id, shift.id, "CASH", 100, "PENDING");
    // A pending payment leaves the order unsettled; cancel it so the live-order
    // guard is not what this test measures.
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });

    const closed = await callerFor(cashier).shift.close({
      branchId: branch.id,
      closingCash: 300,
    });
    expect(closed.expectedCash).toBe(300);
  });

  it("expects just the float when nothing was sold", async () => {
    await callerFor(cashier).shift.open({ branchId: branch.id, openingCash: 750.5 });
    const closed = await callerFor(cashier).shift.close({
      branchId: branch.id,
      closingCash: 750.5,
    });
    expect(closed.expectedCash).toBe(750.5);
    expect(closed.variance).toBe(0);
  });
});

describe("shift variance maths", () => {
  /** Open, take `cashSales` in ₹100 cash sales, close on `counted`. */
  async function runTill(openingCash: number, sales: number, counted: number) {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash,
    });
    for (let i = 0; i < sales; i += 1) {
      const order = await createOrderOnShift(shift.id);
      await payOnShift(order.id, shift.id, "CASH", 100);
    }
    return callerFor(cashier).shift.close({
      branchId: branch.id,
      closingCash: counted,
    });
  }

  it("reports zero variance on an exact count", async () => {
    const closed = await runTill(1000, 3, 1300);
    expect(closed.expectedCash).toBe(1300);
    expect(closed.closingCash).toBe(1300);
    expect(closed.variance).toBe(0);
    expect(closed.varianceExplanation).toMatch(/matches/i);
  });

  it("reports a positive variance when the drawer is over", async () => {
    const closed = await runTill(1000, 2, 1250);
    expect(closed.expectedCash).toBe(1200);
    expect(closed.variance).toBe(50);
    expect(closed.varianceExplanation).toMatch(/over by/i);
  });

  it("reports a negative variance when the drawer is short", async () => {
    const closed = await runTill(1000, 2, 1120.5);
    expect(closed.expectedCash).toBe(1200);
    expect(closed.variance).toBeCloseTo(-79.5, 2);
    expect(closed.varianceExplanation).toMatch(/short by/i);
  });

  it("snapshots the variance so a later payment edit cannot rewrite it", async () => {
    const closed = await runTill(1000, 1, 1100);
    expect(closed.variance).toBe(0);

    // Someone voids a cash payment after the till was counted.
    await prisma.payment.updateMany({
      where: { shiftId: closed.id, method: "CASH" },
      data: { status: "REFUNDED" },
    });

    const stored = await prisma.shift.findUniqueOrThrow({
      where: { id: closed.id },
    });
    expect(Number(stored.expectedCash)).toBe(1100);
    expect(Number(stored.variance)).toBe(0);

    const summary = await callerFor(manager).shift.summary({ shiftId: closed.id });
    expect(summary.expectedCash).toBe(1100);
    expect(summary.variance).toBe(0);
  });
});

describe("shift.close guards", () => {
  it("rejects closing when no shift is open", async () => {
    await expect(
      callerFor(cashier).shift.close({ branchId: branch.id, closingCash: 0 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("blocks the close while live orders still belong to the shift", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 1000,
    });
    await createOrderOnShift(shift.id);
    await createOrderOnShift(shift.id);

    await expect(
      callerFor(cashier).shift.close({ branchId: branch.id, closingCash: 1000 }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("2 orders"),
    });

    const stillOpen = await prisma.shift.findUniqueOrThrow({
      where: { id: shift.id },
    });
    expect(stillOpen.status).toBe("OPEN");
  });

  it("allows the close once the live orders are settled or cancelled", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 1000,
    });
    const toSettle = await createOrderOnShift(shift.id);
    const toCancel = await createOrderOnShift(shift.id);

    await payOnShift(toSettle.id, shift.id, "CASH", 100);
    await callerFor(manager).order.cancel({ id: toCancel.id, reason: "walked" });

    const closed = await callerFor(cashier).shift.close({
      branchId: branch.id,
      closingCash: 1100,
    });
    expect(closed.status).toBe("CLOSED");
    expect(closed.variance).toBe(0);
  });

  it("names one open order in the singular", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 100,
    });
    await createOrderOnShift(shift.id);

    await expect(
      callerFor(cashier).shift.close({ branchId: branch.id, closingCash: 100 }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("1 order still open"),
    });
  });
});

describe("resolveOpenShift helper", () => {
  it("returns null when the branch has no open till", async () => {
    expect(await resolveOpenShift(prisma, branch.id)).toBeNull();
  });

  it("returns the open shift so order.create can stamp shiftId", async () => {
    const opened = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 400,
    });
    const resolved = await resolveOpenShift(prisma, branch.id);
    expect(resolved?.id).toBe(opened.id);
  });

  it("stops resolving once the shift closes", async () => {
    await callerFor(cashier).shift.open({ branchId: branch.id, openingCash: 400 });
    await callerFor(cashier).shift.close({ branchId: branch.id, closingCash: 400 });
    expect(await resolveOpenShift(prisma, branch.id)).toBeNull();
  });
});
