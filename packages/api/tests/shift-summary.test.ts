// Tests for shift.summary / shift.report / shift.list.
//
// Every figure below is hand-computed in the test so a regression in the SQL
// aggregation shows up as a concrete wrong rupee amount, not a vague diff.

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
let owner: User;
let item: Item; // ₹200 @ 5% tax → line total 210

const uniq = () => Math.random().toString(36).slice(2, 10);

function callerFor(user: User) {
  const auth: AuthUser = { user, tenant };
  const ctx: Context = {
    db: prisma,
    auth,
    requestId: `req-${uniq()}`,
    clientId: `shiftsum-${uniq()}`,
  };
  return createCaller(ctx);
}

async function orderOnShift(shiftId: string, quantity = 1) {
  const order = await callerFor(cashier).order.create({
    branchId: branch.id,
    type: "TAKEAWAY",
    guestCount: 1,
    items: [{ itemId: item.id, quantity }],
  });
  await prisma.order.update({ where: { id: order.id }, data: { shiftId } });
  return order;
}

async function payOnShift(
  orderId: string,
  shiftId: string,
  method: "CASH" | "CARD" | "UPI",
  amount: number,
) {
  const payment = await callerFor(cashier).payment.record({
    orderId,
    method,
    amount,
    status: "CAPTURED",
  });
  await prisma.payment.update({ where: { id: payment.id }, data: { shiftId } });
  return payment;
}

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
    data: { name: "Summary Tenant", slug: `sum-${uniq()}` },
  });
  branch = await prisma.branch.create({
    data: { tenantId: tenant.id, name: "Summary Main", code: `SUM-${uniq()}` },
  });
  cashier = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `sum-cashier-${uniq()}@t.com`,
      passwordHash: "irrelevant-for-these-tests",
      name: "Summary Cashier",
      role: "CASHIER",
    },
  });
  owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `sum-owner-${uniq()}@t.com`,
      passwordHash: "irrelevant-for-these-tests",
      name: "Summary Owner",
      role: "OWNER",
    },
  });

  const menu = await prisma.menu.create({
    data: { tenantId: tenant.id, name: "Summary Menu" },
  });
  const category = await prisma.category.create({
    data: { menuId: menu.id, name: "Summary Cat" },
  });
  item = await prisma.item.create({
    data: {
      categoryId: category.id,
      name: "Summary Item",
      price: 200,
      taxRate: 5,
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

describe("shift.summary", () => {
  it("matches hand-computed sales, tax and payment breakdown", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 1000,
    });

    // Order 1: qty 1 → net 200, tax 10, gross 210. Paid in cash.
    const first = await orderOnShift(shift.id, 1);
    await payOnShift(first.id, shift.id, "CASH", 210);

    // Order 2: qty 2 → net 400, tax 20, gross 420. Split 220 card / 200 UPI.
    const second = await orderOnShift(shift.id, 2);
    await payOnShift(second.id, shift.id, "CARD", 220);
    await payOnShift(second.id, shift.id, "UPI", 200);

    const summary = await callerFor(owner).shift.summary({ shiftId: shift.id });

    expect(summary.orderCount).toBe(2);
    expect(summary.grossSales).toBeCloseTo(630, 2); // 210 + 420
    expect(summary.netSales).toBeCloseTo(600, 2); // 200 + 400
    expect(summary.taxTotal).toBeCloseTo(30, 2); // 10 + 20
    expect(summary.discountTotal).toBeCloseTo(0, 2);

    expect(summary.paymentBreakdown.CASH).toEqual({ amount: 210, count: 1 });
    expect(summary.paymentBreakdown.CARD).toEqual({ amount: 220, count: 1 });
    expect(summary.paymentBreakdown.UPI).toEqual({ amount: 200, count: 1 });

    // Drawer: 1000 float + 210 cash sale, nothing refunded.
    expect(summary.openingCash).toBe(1000);
    expect(summary.cashIn).toBeCloseTo(210, 2);
    expect(summary.cashRefunds).toBeCloseTo(0, 2);
    expect(summary.expectedCash).toBeCloseTo(1210, 2);

    // Still open: nothing counted yet.
    expect(summary.countedCash).toBeNull();
    expect(summary.variance).toBeNull();
    expect(summary.varianceExplanation).toBeNull();
  });

  it("counts only PAID orders as sales and reports live ones separately", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 0,
    });

    const paid = await orderOnShift(shift.id, 1);
    await payOnShift(paid.id, shift.id, "CASH", 210);
    await orderOnShift(shift.id, 1); // left live

    const summary = await callerFor(owner).shift.summary({ shiftId: shift.id });
    expect(summary.orderCount).toBe(1);
    expect(summary.grossSales).toBeCloseTo(210, 2);
    expect(summary.liveOrderCount).toBe(1);
  });

  it("ignores orders and payments from another shift", async () => {
    const first = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 100,
    });
    const inFirst = await orderOnShift(first.id, 1);
    await payOnShift(inFirst.id, first.id, "CASH", 210);
    await callerFor(cashier).shift.close({
      branchId: branch.id,
      closingCash: 310,
    });

    const second = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 100,
    });
    const inSecond = await orderOnShift(second.id, 2);
    await payOnShift(inSecond.id, second.id, "CASH", 420);

    const firstSummary = await callerFor(owner).shift.summary({
      shiftId: first.id,
    });
    const secondSummary = await callerFor(owner).shift.summary({
      shiftId: second.id,
    });

    expect(firstSummary.grossSales).toBeCloseTo(210, 2);
    expect(firstSummary.expectedCash).toBeCloseTo(310, 2);
    expect(firstSummary.variance).toBe(0);

    expect(secondSummary.grossSales).toBeCloseTo(420, 2);
    expect(secondSummary.expectedCash).toBeCloseTo(520, 2);
  });

  it("reports the counted cash and variance for a closed shift", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 500,
    });
    const order = await orderOnShift(shift.id, 1);
    await payOnShift(order.id, shift.id, "CASH", 210);

    // Expected 710, counted 700 → short by 10.
    await callerFor(cashier).shift.close({
      branchId: branch.id,
      closingCash: 700,
    });

    const summary = await callerFor(owner).shift.summary({ shiftId: shift.id });
    expect(summary.expectedCash).toBeCloseTo(710, 2);
    expect(summary.countedCash).toBeCloseTo(700, 2);
    expect(summary.variance).toBeCloseTo(-10, 2);
    expect(summary.varianceExplanation).toMatch(/short by/i);
  });

  it("returns NOT_FOUND for a shift outside the tenant", async () => {
    const other = await prisma.tenant.create({
      data: { name: "Sum Other", slug: `sumo-${uniq()}` },
    });
    const otherBranch = await prisma.branch.create({
      data: { tenantId: other.id, name: "Other", code: `SUMO-${uniq()}` },
    });
    const otherUser = await prisma.user.create({
      data: {
        tenantId: other.id,
        email: `sumo-${uniq()}@t.com`,
        passwordHash: "irrelevant-for-these-tests",
        name: "Other Cashier",
        role: "CASHIER",
      },
    });
    const foreign = await prisma.shift.create({
      data: {
        branchId: otherBranch.id,
        openedById: otherUser.id,
        openingCash: 100,
      },
    });

    await expect(
      callerFor(owner).shift.summary({ shiftId: foreign.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await prisma.tenant.delete({ where: { id: other.id } });
  });
});

describe("shift.report", () => {
  it("carries the branch and both operators alongside the money", async () => {
    const shift = await callerFor(cashier).shift.open({
      branchId: branch.id,
      openingCash: 300,
    });
    const order = await orderOnShift(shift.id, 1);
    await payOnShift(order.id, shift.id, "CASH", 210);
    await callerFor(owner).shift.close({
      branchId: branch.id,
      closingCash: 510,
    });

    const report = await callerFor(owner).shift.report({ shiftId: shift.id });
    expect(report.branch.id).toBe(branch.id);
    expect(report.openedBy.name).toBe(cashier.name);
    expect(report.closedBy?.name).toBe(owner.name);
    expect(report.expectedCash).toBeCloseTo(510, 2);
    expect(report.variance).toBe(0);
    expect(report.grossSales).toBeCloseTo(210, 2);
  });
});

describe("shift.list", () => {
  it("returns recent shifts newest first with variance history", async () => {
    for (const [opening, counted] of [
      [100, 100],
      [200, 190],
      [300, 325],
    ] as const) {
      await callerFor(cashier).shift.open({
        branchId: branch.id,
        openingCash: opening,
      });
      await callerFor(cashier).shift.close({
        branchId: branch.id,
        closingCash: counted,
      });
    }

    const { shifts } = await callerFor(owner).shift.list({
      branchId: branch.id,
      limit: 20,
    });

    expect(shifts).toHaveLength(3);
    expect(shifts[0]?.openingCash).toBe(300); // newest first
    expect(shifts[0]?.variance).toBe(25);
    expect(shifts[1]?.variance).toBe(-10);
    expect(shifts[2]?.variance).toBe(0);
    expect(shifts[0]?.openedBy.name).toBe(cashier.name);
    // Money is plain numbers on the wire.
    expect(typeof shifts[0]?.expectedCash).toBe("number");
  });

  it("paginates by cursor", async () => {
    for (let i = 0; i < 3; i += 1) {
      await callerFor(cashier).shift.open({
        branchId: branch.id,
        openingCash: 100 + i,
      });
      await callerFor(cashier).shift.close({
        branchId: branch.id,
        closingCash: 100 + i,
      });
    }

    const first = await callerFor(owner).shift.list({
      branchId: branch.id,
      limit: 2,
    });
    expect(first.shifts).toHaveLength(2);
    expect(first.nextCursor).toBeDefined();

    const second = await callerFor(owner).shift.list({
      branchId: branch.id,
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect(second.shifts).toHaveLength(1);
    expect(second.nextCursor).toBeUndefined();
  });

  it("filters by status", async () => {
    await callerFor(cashier).shift.open({ branchId: branch.id, openingCash: 50 });
    await callerFor(cashier).shift.close({ branchId: branch.id, closingCash: 50 });
    await callerFor(cashier).shift.open({ branchId: branch.id, openingCash: 60 });

    const open = await callerFor(owner).shift.list({
      branchId: branch.id,
      status: "OPEN",
      limit: 20,
    });
    expect(open.shifts).toHaveLength(1);
    expect(open.shifts[0]?.openingCash).toBe(60);
  });
});
