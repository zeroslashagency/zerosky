// reports-top-items.test.ts — topItems router tests
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
let branch: Branch;
let owner: User;
let menu: Menu;
let category: Category;
let item1: Item;
let item2: Item;
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
      name: `Top Items Test ${uniq()}`,
      slug: `top-items-${uniq()}`,
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

  item1 = await prisma.item.create({
    data: {
      categoryId: category.id,
      name: "Item 1",
      price: 100,
      taxRate: 5,
      sortOrder: 1,
    },
  });

  item2 = await prisma.item.create({
    data: {
      categoryId: category.id,
      name: "Item 2",
      price: 200,
      taxRate: 5,
      sortOrder: 2,
    },
  });
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { order: { branchId: branch.id } } });
  await prisma.orderItem.deleteMany({ where: { order: { branchId: branch.id } } });
  await prisma.order.deleteMany({ where: { branchId: branch.id } });
  await prisma.item.deleteMany({ where: { category: { menuId: menu.id } } });
  await prisma.category.deleteMany({ where: { menuId: menu.id } });
  await prisma.menu.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.branch.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.tenant.deleteMany({ where: { id: tenant.id } });
});

describe("reports.topItems", () => {
  it("should only count PAID orders", async () => {
    const caller = await callerFor(owner, tenant);

    // Create PAID order with item1
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
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: paidOrder.id,
        name: "Test Item",
        itemId: item1.id,
        quantity: 2,
        unitPrice: 100,
        lineTotal: 200,
        taxRate: 5,
      },
    });

    // Create OPEN order with item1 (should not count)
    const openOrder = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "OPEN",
        subtotal: 100,
        taxTotal: 5,
        discountTotal: 0,
        grandTotal: 105,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: openOrder.id,
        name: "Test Item",
        itemId: item1.id,
        quantity: 5,
        unitPrice: 100,
        lineTotal: 500,
        taxRate: 5,
      },
    });

    const result = await caller.reports.topItems({
      tenantId: tenant.id,
    });

    // Should only count the PAID order (quantity 2)
    const item1Data = result.find(r => r.itemId === item1.id);
    expect(item1Data?.totalQuantity).toBe(2);
    expect(item1Data?.totalRevenue).toBe(200);

    await prisma.orderItem.deleteMany({ where: { orderId: { in: [paidOrder.id, openOrder.id] } } });
    await prisma.order.deleteMany({ where: { id: { in: [paidOrder.id, openOrder.id] } } });
  });

  it("should sort by quantity descending", async () => {
    const caller = await callerFor(owner, tenant);

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
      },
    });

    // item1: quantity 10
    await prisma.orderItem.create({
      data: {
        orderId: order1.id,
        name: "Test Item",
        itemId: item1.id,
        quantity: 10,
        unitPrice: 100,
        lineTotal: 1000,
        taxRate: 5,
      },
    });

    // item2: quantity 3
    await prisma.orderItem.create({
      data: {
        orderId: order1.id,
        name: "Test Item",
        itemId: item2.id,
        quantity: 3,
        unitPrice: 200,
        lineTotal: 600,
        taxRate: 5,
      },
    });

    const result = await caller.reports.topItems({
      tenantId: tenant.id,
      limit: 10,
    });

    // item1 should come first (higher quantity)
    expect(result[0]?.itemId).toBe(item1.id);
    expect(result[0]?.totalQuantity).toBe(10);
    expect(result[1]?.itemId).toBe(item2.id);
    expect(result[1]?.totalQuantity).toBe(3);

    await prisma.orderItem.deleteMany({ where: { orderId: order1.id } });
    await prisma.order.delete({ where: { id: order1.id } });
  });

  it("should respect limit parameter", async () => {
    const caller = await callerFor(owner, tenant);

    const order1 = await prisma.order.create({
      data: {
        branchId: branch.id,
        orderNumber: `TST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 300,
        taxTotal: 15,
        discountTotal: 0,
        grandTotal: 315,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order1.id,
        name: "Test Item",
        itemId: item1.id,
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
        taxRate: 5,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order1.id,
        name: "Test Item",
        itemId: item2.id,
        quantity: 1,
        unitPrice: 200,
        lineTotal: 200,
        taxRate: 5,
      },
    });

    const result = await caller.reports.topItems({
      tenantId: tenant.id,
      limit: 1,
    });

    // Should only return 1 item
    expect(result).toHaveLength(1);

    await prisma.orderItem.deleteMany({ where: { orderId: order1.id } });
    await prisma.order.delete({ where: { id: order1.id } });
  });

  it("should isolate by tenant", async () => {
    const caller = await callerFor(owner, tenant);

    // Create another tenant
    const otherTenant = await prisma.tenant.create({
      data: {
        name: `Other Tenant ${uniq()}`,
        slug: `other-${uniq()}`,
      },
    });

    const otherBranch = await prisma.branch.create({
      data: {
        tenantId: otherTenant.id,
        name: "Other Branch",
        code: "OTH",
        address: "Other Address",
      },
    });

    const otherMenu = await prisma.menu.create({
      data: {
        tenantId: otherTenant.id,
        name: "Other Menu",
        isDefault: true,
      },
    });

    const otherCategory = await prisma.category.create({
      data: {
        menuId: otherMenu.id,
        name: "Other Category",
        sortOrder: 1,
      },
    });

    const otherItem = await prisma.item.create({
      data: {
        categoryId: otherCategory.id,
        name: "Other Item",
        price: 999,
        taxRate: 5,
        sortOrder: 1,
      },
    });

    // Create order for our tenant
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
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: ourOrder.id,
        name: "Test Item",
        itemId: item1.id,
        quantity: 5,
        unitPrice: 100,
        lineTotal: 500,
        taxRate: 5,
      },
    });

    // Create order for other tenant
    const otherOrder = await prisma.order.create({
      data: {
        branchId: otherBranch.id,
        orderNumber: `OTH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "DINE_IN",
        status: "PAID",
        subtotal: 999,
        taxTotal: 50,
        discountTotal: 0,
        grandTotal: 1049,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: otherOrder.id,
        name: "Other Item",
        itemId: otherItem.id,
        quantity: 100,
        unitPrice: 999,
        lineTotal: 99900,
        taxRate: 5,
      },
    });

    const result = await caller.reports.topItems({
      tenantId: tenant.id,
    });

    // Should only see our tenant's items
    expect(result.every(r => r.itemId !== otherItem.id)).toBe(true);
    const ourItemData = result.find(r => r.itemId === item1.id);
    expect(ourItemData?.totalQuantity).toBe(5);

    // Cleanup
    await prisma.orderItem.deleteMany({ where: { orderId: { in: [ourOrder.id, otherOrder.id] } } });
    await prisma.order.deleteMany({ where: { id: { in: [ourOrder.id, otherOrder.id] } } });
    await prisma.item.delete({ where: { id: otherItem.id } });
    await prisma.category.delete({ where: { id: otherCategory.id } });
    await prisma.menu.delete({ where: { id: otherMenu.id } });
    await prisma.branch.delete({ where: { id: otherBranch.id } });
    await prisma.tenant.delete({ where: { id: otherTenant.id } });
  });
});
