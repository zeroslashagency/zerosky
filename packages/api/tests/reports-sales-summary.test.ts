// reports-sales-summary.test.ts — salesSummary router tests
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAuthService,
  createInMemorySessionStore,
  hashPassword,
  hashPin,
  setAuthService,
} from "@zerosky/auth";
import { prisma } from "@zerosky/database";
import type { Tenant, Branch, User, Order } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import { createContext, type AuthUser } from "../src/context.js";
import { createCallerFactory, setRateLimiter, createInMemoryRateLimiter } from "../src/trpc.js";

const createCaller = createCallerFactory(appRouter);

let tenant: Tenant;
let otherTenant: Tenant;
let branch: Branch;
let otherBranch: Branch;
let owner: User;
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

  // Create two tenants for isolation testing
  tenant = await prisma.tenant.create({
    data: {
      name: `Reports Test Tenant ${uniq()}`,
      slug: `reports-test-${uniq()}`,
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
});

afterAll(async () => {
  // Cleanup in FK-safe order
  await prisma.payment.deleteMany({ where: { order: { branch: { tenantId: { in: [tenant.id, otherTenant.id] } } } } });
  await prisma.orderItem.deleteMany({ where: { order: { branch: { tenantId: { in: [tenant.id, otherTenant.id] } } } } });
  await prisma.order.deleteMany({ where: { branch: { tenantId: { in: [tenant.id, otherTenant.id] } } } });
  await prisma.user.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
  await prisma.branch.deleteMany({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenant.id, otherTenant.id] } } });
});

describe("reports.salesSummary", () => {
  it("should only count PAID orders in revenue", async () => {
    const caller = await callerFor(owner, tenant);

    // Create one PAID order and one OPEN order
    const paidOrder = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${uniq()}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
      },
    });

    const openOrder = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${uniq()}`,
        type: "DINE_IN",
        status: "OPEN",
        subtotal: 200,
        taxTotal: 10,
        discountTotal: 0,
        grandTotal: 210,
      },
    });

    const result = await caller.reports.salesSummary({
      tenantId: tenant.id,
      startDate: new Date(Date.now() - 86400000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });

    // Only PAID order should count
    expect(result.totalRevenue).toBe(105);
    expect(result.totalOrders).toBe(1);

    // Cleanup
    await prisma.order.deleteMany({ where: { id: { in: [paidOrder.id, openOrder.id] } } });
  });

  it("should calculate average order value correctly", async () => {
    const caller = await callerFor(owner, tenant);

    const order1 = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${uniq()}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
      },
    });

    const order2 = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${uniq()}`,
        type: "TAKEAWAY",
        status: "PAID",
        subtotal: 200,
        taxTotal: 10,
        discountTotal: 0,
        grandTotal: 210,
      },
    });

    const result = await caller.reports.salesSummary({
      tenantId: tenant.id,
      startDate: new Date(Date.now() - 86400000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });

    expect(result.totalRevenue).toBe(315); // 105 + 210
    expect(result.totalOrders).toBe(2);
    expect(result.avgOrderValue).toBe(157.5); // 315 / 2

    await prisma.order.deleteMany({ where: { id: { in: [order1.id, order2.id] } } });
  });

  it("should isolate data by tenant", async () => {
    const caller = await callerFor(owner, tenant);

    // Create order for our tenant
    const ourOrder = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${uniq()}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
      },
    });

    // Create order for other tenant
    const theirOrder = await prisma.order.create({
      data: {
        branchId: otherBranch.id,
        orderNumber: `OTH-${uniq()}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 500,
        taxTotal: 25,
        discountTotal: 0,
        grandTotal: 525,
      },
    });

    const result = await caller.reports.salesSummary({
      tenantId: tenant.id,
      startDate: new Date(Date.now() - 86400000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });

    // Should only see our tenant's order
    expect(result.totalRevenue).toBe(105);
    expect(result.totalOrders).toBe(1);

    await prisma.order.deleteMany({ where: { id: { in: [ourOrder.id, theirOrder.id] } } });
  });

  it("should filter by branch when branchId is provided", async () => {
    const caller = await callerFor(owner, tenant);

    const branch2 = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: "Branch 2",
        code: "BR2",
        address: "Address 2",
      },
    });

    const order1 = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${uniq()}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
      },
    });

    const order2 = await prisma.order.create({
      data: {
        branchId: branch2.id,
        orderNumber: `BR2-${uniq()}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 200,
        taxTotal: 10,
        discountTotal: 0,
        grandTotal: 210,
      },
    });

    // Query only branch 1
    const result = await caller.reports.salesSummary({
      tenantId: tenant.id,
      branchId: branch.id,
      startDate: new Date(Date.now() - 86400000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
    });

    expect(result.totalRevenue).toBe(105);
    expect(result.totalOrders).toBe(1);

    await prisma.order.deleteMany({ where: { id: { in: [order1.id, order2.id] } } });
    await prisma.branch.delete({ where: { id: branch2.id } });
  });
});
