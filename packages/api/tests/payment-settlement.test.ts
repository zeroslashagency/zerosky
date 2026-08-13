// Tests that recording a payment actually settles the order.
//
// payment.record used to only insert a payment row. The order stayed in its
// previous state (e.g. SENT_TO_KITCHEN) even when fully paid, so its revenue
// never appeared in reports.salesSummary, which counts PAID orders only, and
// the table stayed occupied on the floor plan.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
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
    clientId: `pay-${uniq()}`,
  };
  return createCaller(ctx);
}

/** Create an order with a single line of the seeded item. */
async function createOrder(tableId?: string) {
  const caller = callerFor(cashier);
  return caller.order.create({
    branchId: branch.id,
    tableId,
    type: "DINE_IN",
    guestCount: 2,
    items: [{ itemId: item.id, quantity: 1 }],
  });
}

beforeAll(async () => {
  setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));

  tenant = await prisma.tenant.create({
    data: { name: "Pay Tenant", slug: `pay-${uniq()}` },
  });
  branch = await prisma.branch.create({
    data: { tenantId: tenant.id, name: "Pay Main", code: `PAY-${uniq()}` },
  });
  cashier = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `pay-cashier-${uniq()}@t.com`,
      passwordHash: "irrelevant-for-these-tests",
      name: "Pay Cashier",
      role: "CASHIER",
    },
  });

  const menu = await prisma.menu.create({
    data: { tenantId: tenant.id, name: "Pay Menu" },
  });
  const category = await prisma.category.create({
    data: { menuId: menu.id, name: "Pay Cat" },
  });
  item = await prisma.item.create({
    data: {
      categoryId: category.id,
      name: "Pay Item",
      price: 100,
      taxRate: 5,
    },
  });
});

afterAll(async () => {
  await prisma.tenant.delete({ where: { id: tenant.id } });
  await prisma.$disconnect();
});

describe("payment.record settlement", () => {
  it("marks the order PAID once captured payments cover the grand total", async () => {
    const order = await createOrder();
    const caller = callerFor(cashier);

    await caller.payment.record({
      orderId: order.id,
      method: "UPI",
      amount: Number(order.grandTotal),
      status: "CAPTURED",
    });

    const settled = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(settled.status).toBe("PAID");
  });

  it("leaves the order unsettled on a partial payment", async () => {
    const order = await createOrder();
    const caller = callerFor(cashier);

    await caller.payment.record({
      orderId: order.id,
      method: "CASH",
      amount: Number(order.grandTotal) / 2,
      status: "CAPTURED",
    });

    const partial = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(partial.status).not.toBe("PAID");
  });

  it("settles once a split payment adds up to the grand total", async () => {
    const order = await createOrder();
    const caller = callerFor(cashier);
    const half = Number(order.grandTotal) / 2;

    await caller.payment.record({
      orderId: order.id,
      method: "CASH",
      amount: half,
      status: "CAPTURED",
    });
    await caller.payment.record({
      orderId: order.id,
      method: "CARD",
      amount: half,
      status: "CAPTURED",
    });

    const settled = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(settled.status).toBe("PAID");
  });

  it("ignores uncaptured payments when deciding to settle", async () => {
    const order = await createOrder();
    const caller = callerFor(cashier);

    await caller.payment.record({
      orderId: order.id,
      method: "CARD",
      amount: Number(order.grandTotal),
      status: "PENDING",
    });

    const pending = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(pending.status).not.toBe("PAID");
  });

  it("occupies the table when a dine-in order is created", async () => {
    const table = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `PT-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    await createOrder(table.id);

    const seated = await prisma.table.findUniqueOrThrow({
      where: { id: table.id },
    });
    expect(seated.state).toBe("OCCUPIED");
  });

  it("frees the table when the order settles", async () => {
    const table = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `PT-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });
    const order = await createOrder(table.id);
    const caller = callerFor(cashier);

    await caller.payment.record({
      orderId: order.id,
      method: "CASH",
      amount: Number(order.grandTotal),
      status: "CAPTURED",
    });

    const freed = await prisma.table.findUniqueOrThrow({
      where: { id: table.id },
    });
    expect(freed.state).toBe("AVAILABLE");
  });

  it("releases the table when a seated order is cancelled", async () => {
    const table = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `PT-${uniq()}`,
        seats: 2,
        state: "AVAILABLE",
      },
    });
    const order = await createOrder(table.id);
    const owner = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `pay-owner-${uniq()}@t.com`,
        passwordHash: "irrelevant-for-these-tests",
        name: "Pay Owner",
        role: "OWNER",
      },
    });

    await callerFor(owner).order.cancel({ id: order.id, reason: "walked out" });

    const freed = await prisma.table.findUniqueOrThrow({
      where: { id: table.id },
    });
    expect(freed.state).toBe("AVAILABLE");
  });

  it("keeps the table occupied if another live order still uses it", async () => {
    const table = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `PT-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });
    const first = await createOrder(table.id);
    await createOrder(table.id);
    const owner = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `pay-owner2-${uniq()}@t.com`,
        passwordHash: "irrelevant-for-these-tests",
        name: "Pay Owner 2",
        role: "OWNER",
      },
    });

    await callerFor(owner).order.cancel({ id: first.id });

    const stillSeated = await prisma.table.findUniqueOrThrow({
      where: { id: table.id },
    });
    expect(stillSeated.state).toBe("OCCUPIED");
  });

  it("refuses to record a payment on a cancelled order", async () => {
    const order = await createOrder();
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });
    const caller = callerFor(cashier);

    await expect(
      caller.payment.record({
        orderId: order.id,
        method: "CASH",
        amount: Number(order.grandTotal),
        status: "CAPTURED",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
