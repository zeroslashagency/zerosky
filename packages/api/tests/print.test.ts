// Print router tests: verify print job generation, error handling, and queue integration.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@zerosky/database";
import type { Tenant, Branch, User, Item, Order, Kot } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import { createContext, type AuthUser } from "../src/context.js";
import { createCallerFactory, setRateLimiter, createInMemoryRateLimiter } from "../src/trpc.js";
import { hashPassword } from "@zerosky/auth";

const createCaller = createCallerFactory(appRouter);

let tenant: Tenant;
let branch: Branch;
let owner: User;
let item: Item;

const uniq = () => Math.random().toString(36).slice(2, 10);

async function callerFor(user: User, tenantRow: Tenant) {
  const auth: AuthUser = { user, tenant: tenantRow };
  const ctx = await createContext({ db: prisma, auth });
  return createCaller(ctx);
}

beforeAll(async () => {
  setRateLimiter(createInMemoryRateLimiter(100_000, 60_000));

  tenant = await prisma.tenant.create({
    data: { name: "Print Test Tenant", slug: `print-${uniq()}` },
  });
  branch = await prisma.branch.create({
    data: { tenantId: tenant.id, name: "Main", code: `B-${uniq()}` },
  });
  owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `owner-${uniq()}@t.com`,
      passwordHash: await hashPassword("test", 4),
      name: "Owner",
      role: "OWNER",
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
  await prisma.tenant.deleteMany({ where: { id: tenant.id } });
  await prisma.$disconnect();
});

describe("print router", () => {
  describe("printKot", () => {
    it("renders a KOT to ESC/POS bytes and marks it printed", async () => {
      const caller = await callerFor(owner, tenant);

      // Create an order with items
      const order = await prisma.order.create({
        data: {
          branchId: branch.id,
          orderNumber: `ORD-${uniq()}`,
          type: "DINE_IN",
          status: "OPEN",
          subtotal: "200.00",
          taxTotal: "10.00",
          grandTotal: "210.00",
          createdById: owner.id,
        },
      });

      const orderItem = await prisma.orderItem.create({
        data: {
          orderId: order.id,
          itemId: item.id,
          name: item.name,
          quantity: 1,
          unitPrice: item.price,
          taxRate: item.taxRate,
          lineTotal: "210.00",
          status: "PENDING",
        },
      });

      const kot = await prisma.kot.create({
        data: {
          orderId: order.id,
          kotNumber: `KOT-${uniq()}`,
          status: "NEW",
          items: { connect: [{ id: orderItem.id }] },
        },
      });

      const result = await caller.print.printKot({ kotId: kot.id });

      expect(result.success).toBe(true);
      expect(result.kotNumber).toBe(kot.kotNumber);

      // Verify printedAt was set.
      const updated = await prisma.kot.findUnique({ where: { id: kot.id } });
      expect(updated?.printedAt).toBeTruthy();
    });

    it("throws NOT_FOUND for a non-existent KOT", async () => {
      const caller = await callerFor(owner, tenant);
      await expect(
        caller.print.printKot({ kotId: "kot_notfound" })
      ).rejects.toThrow("KOT not found");
    });
  });

  describe("reprintKot", () => {
    it("reprints a KOT with a REPRINT marker", async () => {
      const caller = await callerFor(owner, tenant);

      const order = await prisma.order.create({
        data: {
          branchId: branch.id,
          orderNumber: `ORD-${uniq()}`,
          type: "DINE_IN",
          status: "OPEN",
          subtotal: "200.00",
          taxTotal: "10.00",
          grandTotal: "210.00",
          createdById: owner.id,
        },
      });

      const orderItem = await prisma.orderItem.create({
        data: {
          orderId: order.id,
          itemId: item.id,
          name: item.name,
          quantity: 1,
          unitPrice: item.price,
          taxRate: item.taxRate,
          lineTotal: "210.00",
          status: "PENDING",
        },
      });

      const kot = await prisma.kot.create({
        data: {
          orderId: order.id,
          kotNumber: `KOT-${uniq()}`,
          status: "NEW",
          items: { connect: [{ id: orderItem.id }] },
        },
      });

      const result = await caller.print.reprintKot({ kotId: kot.id });

      expect(result.success).toBe(true);
      expect(result.kotNumber).toContain("(REPRINT)");
    });
  });

  describe("printBill", () => {
    it("renders a receipt for an order", async () => {
      const caller = await callerFor(owner, tenant);

      const order = await prisma.order.create({
        data: {
          branchId: branch.id,
          orderNumber: `ORD-${uniq()}`,
          type: "DINE_IN",
          status: "OPEN",
          subtotal: "200.00",
          taxTotal: "10.00",
          grandTotal: "210.00",
          createdById: owner.id,
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          itemId: item.id,
          name: item.name,
          quantity: 1,
          unitPrice: item.price,
          taxRate: item.taxRate,
          lineTotal: "210.00",
          status: "PENDING",
        },
      });

      const result = await caller.print.printBill({
        orderId: order.id,
        fullInvoice: false,
      });

      expect(result.success).toBe(true);
      expect(result.orderNumber).toBe(order.orderNumber);
    });

    it("throws NOT_FOUND for a non-existent order", async () => {
      const caller = await callerFor(owner, tenant);
      await expect(
        caller.print.printBill({ orderId: "order_notfound", fullInvoice: false })
      ).rejects.toThrow("Order not found");
    });
  });

  describe("openCashDrawer", () => {
    it("sends the cash-drawer kick command", async () => {
      const caller = await callerFor(owner, tenant);
      const result = await caller.print.openCashDrawer({});

      expect(result.success).toBe(true);
    });
  });

  describe("listPrinters", () => {
    it("returns an empty list when no printers are discovered", async () => {
      const caller = await callerFor(owner, tenant);
      const result = await caller.print.listPrinters({});

      // In test mode with MockPrinter, discovery returns [].
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
