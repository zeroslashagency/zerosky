// Tests for table transfer, merge, and bill split operations.
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
let waiter: User;
let cashier: User;
let item: Item;

const uniq = () => Math.random().toString(36).slice(2, 10);

function callerFor(user: User) {
  const auth: AuthUser = { user, tenant };
  const ctx: Context = {
    db: prisma,
    auth,
    requestId: `req-${uniq()}`,
    clientId: `tbl-${uniq()}`,
  };
  return createCaller(ctx);
}

/** Create an order with a single line of the seeded item. */
async function createOrder(tableId?: string, seat?: number) {
  const caller = callerFor(waiter);
  return caller.order.create({
    branchId: branch.id,
    tableId,
    type: "DINE_IN",
    guestCount: 2,
    items: [{ itemId: item.id, quantity: 1, seat }],
  });
}

beforeAll(async () => {
  setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));

  tenant = await prisma.tenant.create({
    data: { name: "Table Ops Tenant", slug: `tbl-${uniq()}` },
  });
  branch = await prisma.branch.create({
    data: { tenantId: tenant.id, name: "Table Main", code: `TBL-${uniq()}` },
  });
  waiter = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `tbl-waiter-${uniq()}@t.com`,
      passwordHash: "irrelevant-for-these-tests",
      name: "Table Waiter",
      role: "WAITER",
    },
  });
  cashier = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `tbl-cashier-${uniq()}@t.com`,
      passwordHash: "irrelevant-for-these-tests",
      name: "Table Cashier",
      role: "CASHIER",
    },
  });

  const menu = await prisma.menu.create({
    data: { tenantId: tenant.id, name: "Table Menu" },
  });
  const category = await prisma.category.create({
    data: { menuId: menu.id, name: "Table Cat" },
  });
  item = await prisma.item.create({
    data: {
      categoryId: category.id,
      name: "Table Item",
      price: 100,
      taxRate: 5,
    },
  });
});

afterAll(async () => {
  await prisma.tenant.delete({ where: { id: tenant.id } });
  await prisma.$disconnect();
});

describe("table.transferOrder", () => {
  it("moves the order from source to destination table", async () => {
    const t1 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `T1-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });
    const t2 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `T2-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    const order = await createOrder(t1.id);
    const caller = callerFor(waiter);

    const transferred = await caller.table.transferOrder({
      orderId: order.id,
      fromTableId: t1.id,
      toTableId: t2.id,
    });

    expect(transferred.tableId).toBe(t2.id);
    const t1After = await prisma.table.findUniqueOrThrow({ where: { id: t1.id } });
    const t2After = await prisma.table.findUniqueOrThrow({ where: { id: t2.id } });
    expect(t1After.state).toBe("AVAILABLE");
    expect(t2After.state).toBe("OCCUPIED");
  });

  it("rejects transfer to an already occupied table", async () => {
    const t1 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `T3-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });
    const t2 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `T4-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    const order1 = await createOrder(t1.id);
    await createOrder(t2.id); // t2 now has a live order
    const caller = callerFor(waiter);

    await expect(
      caller.table.transferOrder({
        orderId: order1.id,
        fromTableId: t1.id,
        toTableId: t2.id,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("keeps source occupied if another live order still holds it", async () => {
    const t1 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `T5-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });
    const t2 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `T6-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    const order1 = await createOrder(t1.id);
    await createOrder(t1.id); // Second order on t1
    const caller = callerFor(waiter);

    await caller.table.transferOrder({
      orderId: order1.id,
      fromTableId: t1.id,
      toTableId: t2.id,
    });

    const t1After = await prisma.table.findUniqueOrThrow({ where: { id: t1.id } });
    expect(t1After.state).toBe("OCCUPIED"); // Still busy
  });

  it("rejects cross-branch transfer", async () => {
    const otherBranch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: "Other Branch",
        code: `OTH-${uniq()}`,
      },
    });
    const t1 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `T7-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });
    const t2 = await prisma.table.create({
      data: {
        branchId: otherBranch.id,
        name: `T8-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    const order = await createOrder(t1.id);
    const caller = callerFor(waiter);

    await expect(
      caller.table.transferOrder({
        orderId: order.id,
        fromTableId: t1.id,
        toTableId: t2.id,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("table.mergeOrders", () => {
  it("combines items from multiple orders onto the primary", async () => {
    const t1 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `TM1-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });
    const t2 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `TM2-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    const order1 = await createOrder(t1.id);
    const order2 = await createOrder(t2.id);
    const caller = callerFor(waiter);

    const merged = await caller.table.mergeOrders({
      orderIds: [order1.id, order2.id],
      primaryOrderId: order1.id,
    });

    expect(merged.id).toBe(order1.id);
    expect(merged.items.length).toBe(2); // Combined

    const order2After = await prisma.order.findUniqueOrThrow({
      where: { id: order2.id },
    });
    expect(order2After.status).toBe("CANCELLED");

    const t2After = await prisma.table.findUniqueOrThrow({ where: { id: t2.id } });
    expect(t2After.state).toBe("AVAILABLE");
  });

  it("recomputes totals correctly after merge", async () => {
    const t1 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `TM3-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });
    const t2 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `TM4-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    const order1 = await createOrder(t1.id);
    const order2 = await createOrder(t2.id);
    const caller = callerFor(waiter);

    const merged = await caller.table.mergeOrders({
      orderIds: [order1.id, order2.id],
      primaryOrderId: order1.id,
    });

    // Each item: price=100, taxRate=5 → lineNet=100, lineTax=5, lineTotal=105
    // 2 items → subtotal=200, taxTotal=10, grandTotal=210
    expect(Number(merged.subtotal)).toBe(200);
    expect(Number(merged.taxTotal)).toBe(10);
    expect(Number(merged.grandTotal)).toBe(210);
  });

  it("releases vacated tables", async () => {
    const t1 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `TM5-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });
    const t2 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `TM6-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    const order1 = await createOrder(t1.id);
    const order2 = await createOrder(t2.id);
    const caller = callerFor(waiter);

    await caller.table.mergeOrders({
      orderIds: [order1.id, order2.id],
      primaryOrderId: order1.id,
    });

    const t2After = await prisma.table.findUniqueOrThrow({ where: { id: t2.id } });
    expect(t2After.state).toBe("AVAILABLE");
  });

  it("rejects merging a PAID order", async () => {
    const t1 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `TM7-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });
    const t2 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `TM8-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    const order1 = await createOrder(t1.id);
    const order2 = await createOrder(t2.id);
    await prisma.order.update({
      where: { id: order2.id },
      data: { status: "PAID" },
    });
    const caller = callerFor(waiter);

    await expect(
      caller.table.mergeOrders({
        orderIds: [order1.id, order2.id],
        primaryOrderId: order1.id,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("payment.splitBill", () => {
  it("validates amount parts sum exactly to grand total", async () => {
    const order = await createOrder();
    const caller = callerFor(cashier);

    // grandTotal=105 (100 + 5% tax)
    await expect(
      caller.payment.splitBill({
        orderId: order.id,
        method: { type: "amount", parts: [50, 50] }, // Sum=100, not 105
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts a valid amount split", async () => {
    const order = await createOrder();
    const caller = callerFor(cashier);

    const result = await caller.payment.splitBill({
      orderId: order.id,
      method: { type: "amount", parts: [52.5, 52.5] }, // Sum=105
    });

    expect(result.parts.length).toBe(2);
    expect(result.parts[0]?.amount).toBe(52.5);
    expect(result.parts[1]?.amount).toBe(52.5);
  });

  it("handles non-divisible amounts without losing paise", async () => {
    const order = await createOrder();
    const caller = callerFor(cashier);

    // Split 105 into 3 parts: 35, 35, 35
    const result = await caller.payment.splitBill({
      orderId: order.id,
      method: { type: "amount", parts: [35, 35, 35] },
    });

    const total = result.parts.reduce((sum, p) => sum + p.amount, 0);
    expect(total).toBe(105); // No rounding loss
  });

  it("splits by seat correctly", async () => {
    const t1 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `TS1-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    // Create an order with items on different seats
    const caller = callerFor(cashier);
    const order = await caller.order.create({
      branchId: branch.id,
      tableId: t1.id,
      type: "DINE_IN",
      guestCount: 2,
      items: [
        { itemId: item.id, quantity: 1, seat: 1 },
        { itemId: item.id, quantity: 1, seat: 2 },
      ],
    });

    const result = await caller.payment.splitBill({
      orderId: order.id,
      method: { type: "seat" },
    });

    expect(result.parts.length).toBe(2);
    const part0 = result.parts.find((p: any) => p.seat === 1);
    const part1 = result.parts.find((p: any) => p.seat === 2);
    expect(part0).toBeDefined();
    expect(part1).toBeDefined();
    if (part0 && part1) {
      expect(part0.amount).toBe(105); // 100 + 5
      expect(part1.amount).toBe(105);
    }
  });

  it("ensures seat-split parts sum exactly to grand total", async () => {
    const t1 = await prisma.table.create({
      data: {
        branchId: branch.id,
        name: `TS2-${uniq()}`,
        seats: 4,
        state: "AVAILABLE",
      },
    });

    const caller = callerFor(cashier);
    const order = await caller.order.create({
      branchId: branch.id,
      tableId: t1.id,
      type: "DINE_IN",
      guestCount: 3,
      items: [
        { itemId: item.id, quantity: 1, seat: 1 },
        { itemId: item.id, quantity: 1, seat: 2 },
        { itemId: item.id, quantity: 1, seat: 3 },
      ],
    });

    const result = await caller.payment.splitBill({
      orderId: order.id,
      method: { type: "seat" },
    });

    const total = result.parts.reduce((sum, p) => sum + p.amount, 0);
    expect(total).toBe(Number(order.grandTotal));
  });
});
