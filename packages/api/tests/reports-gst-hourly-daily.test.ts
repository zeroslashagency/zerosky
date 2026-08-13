// reports-gst-hourly-daily.test.ts — gstReport, hourlySales, dailySales router tests
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAuthService,
  createInMemorySessionStore,
  hashPassword,
  hashPin,
  setAuthService,
} from "@zerosky/auth";
import { prisma } from "@zerosky/database";
import type { Tenant, Branch, User, Menu, Category, Item } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import { createContext, type AuthUser } from "../src/context.js";
import { createCallerFactory, setRateLimiter, createInMemoryRateLimiter } from "../src/trpc.js";

const createCaller = createCallerFactory(appRouter);

let tenant: Tenant;
let otherTenant: Tenant;
let branch: Branch;
let otherBranch: Branch;
let owner: User;
let menu: Menu;
let category: Category;
let item: Item;
let testPasswordHash: string;

const uniq = () => Math.random().toString(36).slice(2, 10);

async function callerFor(user: User, tenantRow: Tenant) {
  const auth: AuthUser = { user, tenant: tenantRow };
  const ctx = await createContext({ db: prisma, auth });
  return createCaller(ctx);
}

beforeAll(async () => {
  setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));
  process.env.JWT_SECRET ??= "integration-test-secret-".padEnd(48, "x");
  setAuthService(createAuthService({ redis: createInMemorySessionStore() }));

  testPasswordHash = await hashPassword("test-password-123");

  tenant = await prisma.tenant.create({
    data: {
      name: `GST Report Test ${uniq()}`,
      slug: `gst-test-${uniq()}`,
    },
  });

  otherTenant = await prisma.tenant.create({
    data: {
      name: `Other Tenant ${uniq()}`,
      slug: `other-${uniq()}`,
    },
  });

  branch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: "Test Branch",
      code: "TST",
      address: "Test Address",
    },
  });

  otherBranch = await prisma.branch.create({
    data: {
      tenantId: otherTenant.id,
      name: "Other Branch",
      code: "OTH",
      address: "Other Address",
    },
  });

  owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `owner-${uniq()}@test.dev`,
      name: "Test Owner",
      role: "OWNER",
      passwordHash: testPasswordHash,
      pinHash: await hashPin("1111"),
    },
  });

  menu = await prisma.menu.create({
    data: {
      tenantId: tenant.id,
      name: "Test Menu",
      isDefault: true,
    },
  });

  category = await prisma.category.create({
    data: {
      menuId: menu.id,
      name: "Test Category",
      sortOrder: 1,
    },
  });

  item = await prisma.item.create({
    data: {
      categoryId: category.id,
      name: "Test Item",
      price: 100,
      taxRate: 5,
      sortOrder: 1,
    },
  });
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { order: { branch: { tenantId: { in: [tenant.id, otherTenant.id] } } } } });
  await prisma.orderItem.deleteMany({ where: { order: { branch: { tenantId: { in: [tenant.id, otherTenant.id] } } } } });
  await prisma.order.deleteMany({ where: { branch: { tenantId: { in: [tenant.id, otherTenant.id] } } } });
  await prisma.item.deleteMany({ where: { category: { menuId: menu.id } } });
  await prisma.category.deleteMany({ where: { menuId: menu.id } });
  await prisma.menu.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
  await prisma.branch.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenant.id, otherTenant.id] } } });
});

describe("reports.gstReport", () => {
  it("should calculate GST correctly with CGST/SGST split", async () => {
    const caller = await callerFor(owner, tenant);

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Create order with ₹100 item @ 5% tax = ₹105 total
    // Taxable value: ₹100, GST: ₹5 (CGST: ₹2.5, SGST: ₹2.5)
    const order = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
        createdAt: now,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        name: "Test Item",
        itemId: item.id,
        quantity: 1,
        unitPrice: 100,
        lineTotal: 105,
        taxRate: 5,
      },
    });

    const result = await caller.reports.gstReport({
      tenantId: tenant.id,
      month,
      year,
    });

    expect(result.month).toBe(month);
    expect(result.year).toBe(year);
    expect(result.totalTaxableValue).toBeCloseTo(100, 1);
    expect(result.totalCGST).toBeCloseTo(2.5, 1);
    expect(result.totalSGST).toBeCloseTo(2.5, 1);
    expect(result.totalGST).toBeCloseTo(5, 1);

    // Check breakdown by rate
    const rate5 = result.breakdown.find(b => b.rate === 5);
    expect(rate5).toBeDefined();
    expect(rate5?.taxableValue).toBeCloseTo(100, 1);
    expect(rate5?.cgst).toBeCloseTo(2.5, 1);
    expect(rate5?.sgst).toBeCloseTo(2.5, 1);

    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  it("should only count PAID orders in GST report", async () => {
    const caller = await callerFor(owner, tenant);

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // PAID order
    const paidOrder = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
        createdAt: now,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: paidOrder.id,
        name: "Test Item",
        itemId: item.id,
        quantity: 1,
        unitPrice: 100,
        lineTotal: 105,
        taxRate: 5,
      },
    });

    // OPEN order (should not count)
    const openOrder = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "OPEN",
        subtotal: 500,
        taxTotal: 25,
        discountTotal: 0,
        grandTotal: 525,
        createdAt: now,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: openOrder.id,
        name: "Test Item",
        itemId: item.id,
        quantity: 5,
        unitPrice: 100,
        lineTotal: 525,
        taxRate: 5,
      },
    });

    const result = await caller.reports.gstReport({
      tenantId: tenant.id,
      month,
      year,
    });

    // Should only reflect PAID order
    expect(result.totalTaxableValue).toBeCloseTo(100, 1);
    expect(result.totalGST).toBeCloseTo(5, 1);

    await prisma.orderItem.deleteMany({ where: { orderId: { in: [paidOrder.id, openOrder.id] } } });
    await prisma.order.deleteMany({ where: { id: { in: [paidOrder.id, openOrder.id] } } });
  });

  it("should isolate by tenant", async () => {
    const caller = await callerFor(owner, tenant);

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Our tenant's order
    const ourOrder = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
        createdAt: now,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: ourOrder.id,
        name: "Test Item",
        itemId: item.id,
        quantity: 1,
        unitPrice: 100,
        lineTotal: 105,
        taxRate: 5,
      },
    });

    // Other tenant's order (should not appear)
    const theirOrder = await prisma.order.create({
      data: {
        branchId: otherBranch.id,
        orderNumber: `OTH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 10000,
        taxTotal: 500,
        discountTotal: 0,
        grandTotal: 10500,
        createdAt: now,
      },
    });

    const result = await caller.reports.gstReport({
      tenantId: tenant.id,
      month,
      year,
    });

    // Should only see our tenant's data
    expect(result.totalTaxableValue).toBeCloseTo(100, 1);
    expect(result.totalGST).toBeCloseTo(5, 1);

    await prisma.orderItem.deleteMany({ where: { orderId: ourOrder.id } });
    await prisma.order.deleteMany({ where: { id: { in: [ourOrder.id, theirOrder.id] } } });
  });
});

describe("reports.hourlySales", () => {
  it("should group sales by hour", async () => {
    const caller = await callerFor(owner, tenant);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create order at 10 AM
    const morning = new Date(today);
    morning.setHours(10, 30, 0, 0);

    const order1 = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
        createdAt: morning,
      },
    });

    // Create order at 3 PM
    const afternoon = new Date(today);
    afternoon.setHours(15, 45, 0, 0);

    const order2 = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 200,
        taxTotal: 10,
        discountTotal: 0,
        grandTotal: 210,
        createdAt: afternoon,
      },
    });

    const result = await caller.reports.hourlySales({
      tenantId: tenant.id,
      date: today.toISOString(),
    });

    // Should have 24 hours
    expect(result).toHaveLength(24);

    // Hour 10 should have ₹105
    const hour10 = result.find(h => h.hour === 10);
    expect(hour10?.revenue).toBe(105);
    expect(hour10?.orders).toBe(1);

    // Hour 15 should have ₹210
    const hour15 = result.find(h => h.hour === 15);
    expect(hour15?.revenue).toBe(210);
    expect(hour15?.orders).toBe(1);

    // Other hours should be zero
    const hour0 = result.find(h => h.hour === 0);
    expect(hour0?.revenue).toBe(0);
    expect(hour0?.orders).toBe(0);

    await prisma.order.deleteMany({ where: { id: { in: [order1.id, order2.id] } } });
  });

  it("should only count PAID orders", async () => {
    const caller = await callerFor(owner, tenant);

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const paidOrder = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
        createdAt: today,
      },
    });

    const openOrder = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "OPEN",
        subtotal: 500,
        taxTotal: 25,
        discountTotal: 0,
        grandTotal: 525,
        createdAt: today,
      },
    });

    const result = await caller.reports.hourlySales({
      tenantId: tenant.id,
      date: today.toISOString(),
    });

    const hour12 = result.find(h => h.hour === 12);
    expect(hour12?.revenue).toBe(105); // Only PAID order
    expect(hour12?.orders).toBe(1);

    await prisma.order.deleteMany({ where: { id: { in: [paidOrder.id, openOrder.id] } } });
  });
});

describe("reports.dailySales", () => {
  it("should group sales by date", async () => {
    const caller = await callerFor(owner, tenant);

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Order today
    const order1 = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 10,
        grandTotal: 95,
        createdAt: today,
      },
    });

    // Order yesterday
    const order2 = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 200,
        taxTotal: 10,
        discountTotal: 0,
        grandTotal: 210,
        createdAt: yesterday,
      },
    });

    const startDate = new Date(yesterday);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    const result = await caller.reports.dailySales({
      tenantId: tenant.id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    expect(result.length).toBeGreaterThanOrEqual(2);

    const todayData = result.find(d => d.date === today.toISOString().split('T')[0]);
    expect(todayData?.revenue).toBe(95);
    expect(todayData?.orders).toBe(1);
    expect(todayData?.tax).toBe(5);
    expect(todayData?.discount).toBe(10);

    const yesterdayData = result.find(d => d.date === yesterday.toISOString().split('T')[0]);
    expect(yesterdayData?.revenue).toBe(210);
    expect(yesterdayData?.orders).toBe(1);
    expect(yesterdayData?.tax).toBe(10);
    expect(yesterdayData?.discount).toBe(0);

    await prisma.order.deleteMany({ where: { id: { in: [order1.id, order2.id] } } });
  });

  it("should isolate by tenant", async () => {
    const caller = await callerFor(owner, tenant);

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    // Our tenant's order
    const ourOrder = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
        createdAt: today,
      },
    });

    // Other tenant's order
    const theirOrder = await prisma.order.create({
      data: {
        branchId: otherBranch.id,
        orderNumber: `OTH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 10000,
        taxTotal: 500,
        discountTotal: 0,
        grandTotal: 10500,
        createdAt: today,
      },
    });

    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    const result = await caller.reports.dailySales({
      tenantId: tenant.id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const todayData = result.find(d => d.date === today.toISOString().split('T')[0]);
    expect(todayData?.revenue).toBe(105); // Only our tenant's order
    expect(todayData?.orders).toBe(1);

    await prisma.order.deleteMany({ where: { id: { in: [ourOrder.id, theirOrder.id] } } });
  });
});
