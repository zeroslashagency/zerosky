import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@zerosky/database";
import { hashPassword } from "@zerosky/auth";
import type { Tenant, Branch, User } from "@zerosky/database";
import { Prisma } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import { createContext, type AuthUser } from "../src/context.js";
import { createCallerFactory } from "../src/trpc.js";

const createCaller = createCallerFactory(appRouter);
const uniq = () => Math.random().toString(36).slice(2, 10);

/**
 * Discount tax ordering (the decision this suite pins down):
 * Indian GST is charged on the discounted consideration, so an order-level
 * discount reduces the taxable base BEFORE tax. Every expected figure below is
 * derived that way and the arithmetic is spelled out inline.
 */
describe("Order discounts", () => {
  let tenant: Tenant;
  let branch: Branch;
  let owner: User;
  let cashier: User;
  let waiter: User;
  let ownerCaller: ReturnType<typeof createCaller>;
  let cashierCaller: ReturnType<typeof createCaller>;
  let waiterCaller: ReturnType<typeof createCaller>;
  let branchId: string;
  let samosaId: string; // ₹100, 5% GST — round numbers for exact arithmetic

  async function callerFor(user: User) {
    const ctx = await createContext({ db: prisma, auth: { user, tenant } as AuthUser });
    return createCaller(ctx);
  }

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: "Discount Tenant", slug: `disc-${uniq()}` },
    });
    branch = await prisma.branch.create({
      data: { tenantId: tenant.id, name: "Main", code: `B-${uniq()}` },
    });
    owner = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `owner-${uniq()}@test.dev`,
        name: "Owner",
        role: "OWNER",
        passwordHash: await hashPassword("test123"),
      },
    });
    cashier = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `cashier-${uniq()}@test.dev`,
        name: "Cashier",
        role: "CASHIER",
        passwordHash: await hashPassword("test123"),
      },
    });
    waiter = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `waiter-${uniq()}@test.dev`,
        name: "Waiter",
        role: "WAITER",
        passwordHash: await hashPassword("test123"),
      },
    });

    branchId = branch.id;
    ownerCaller = await callerFor(owner);
    cashierCaller = await callerFor(cashier);
    waiterCaller = await callerFor(waiter);

    const menu = await prisma.menu.create({
      data: { tenantId: tenant.id, name: "Main Menu", isDefault: true },
    });
    const snacks = await prisma.category.create({
      data: { menuId: menu.id, name: "Snacks", sortOrder: 1 },
    });
    const samosa = await prisma.item.create({
      data: {
        categoryId: snacks.id,
        name: "Samosa",
        price: 100,
        taxRate: 5,
        isVeg: true,
        sortOrder: 1,
      },
    });
    samosaId = samosa.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.branch.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  async function makeOrder(quantity = 4) {
    // 4 × ₹100 = ₹400 subtotal, 5% GST = ₹20, grand ₹420 (no discount yet).
    return ownerCaller.order.create({
      branchId,
      type: "DINE_IN",
      guestCount: 2,
      items: [{ itemId: samosaId, quantity }],
    });
  }

  it("applies a 10% discount with GST on the discounted base", async () => {
    const order = await makeOrder(4);
    // Baseline: subtotal 400, tax 20, grand 420.
    expect(order.subtotal.toString()).toBe("400");
    expect(order.taxTotal.toString()).toBe("20");
    expect(order.grandTotal.toString()).toBe("420");

    const discounted = await ownerCaller.order.applyDiscount({
      orderId: order.id,
      type: "PERCENT",
      value: 10,
      reason: "Loyalty regular",
    });

    // Arithmetic (discount BEFORE tax):
    //   discountTotal = 400 × 10% = 40
    //   taxable base  = 400 − 40 = 360
    //   taxTotal      = 360 × 5% = 18
    //   grandTotal    = 400 − 40 + 18 = 378
    expect(discounted.subtotal.toString()).toBe("400");
    expect(discounted.discountTotal.toString()).toBe("40");
    expect(discounted.taxTotal.toString()).toBe("18");
    expect(discounted.grandTotal.toString()).toBe("378");
    expect(discounted.discountType).toBe("PERCENT");
    expect(discounted.discountValue?.toString()).toBe("10");
    expect(discounted.discountReason).toBe("Loyalty regular");

    console.log(`10% discount, GST on discounted base:
      Subtotal:  ₹${discounted.subtotal.toString()}
      Discount:  -₹${discounted.discountTotal.toString()}
      Taxable:   ₹${discounted.subtotal.sub(discounted.discountTotal).toString()}
      GST (5%):  ₹${discounted.taxTotal.toString()}
      Grand:     ₹${discounted.grandTotal.toString()}
    `);
  });

  it("applies a flat discount with GST on the discounted base", async () => {
    const order = await makeOrder(4); // subtotal 400
    const discounted = await ownerCaller.order.applyDiscount({
      orderId: order.id,
      type: "FLAT",
      value: 50,
      reason: "Manager comp",
    });

    // Arithmetic:
    //   discountTotal = 50 (flat)
    //   taxable base  = 400 − 50 = 350
    //   taxTotal      = 350 × 5% = 17.50
    //   grandTotal    = 400 − 50 + 17.50 = 367.50
    expect(discounted.discountTotal.toString()).toBe("50");
    expect(discounted.taxTotal.toString()).toBe("17.5");
    expect(discounted.grandTotal.toString()).toBe("367.5");
    expect(discounted.discountType).toBe("FLAT");
  });

  it("computes GST on the DISCOUNTED base, not the gross", async () => {
    const order = await makeOrder(4);
    const discounted = await ownerCaller.order.applyDiscount({
      orderId: order.id,
      type: "PERCENT",
      value: 25,
      reason: "Festival offer",
    });

    // The wrong (tax-first) answer would be: tax = 400 × 5% = 20, then
    // grand = 420 − 100 = 320. The correct (discount-first) answer:
    //   discount = 100, taxable = 300, tax = 15, grand = 315.
    const taxable = discounted.subtotal.sub(discounted.discountTotal);
    expect(taxable.toString()).toBe("300");
    expect(discounted.taxTotal.toString()).toBe("15"); // 300 × 5%, NOT 20
    expect(discounted.grandTotal.toString()).toBe("315");
    // Explicit guard against the after-tax bug:
    expect(discounted.taxTotal.toString()).not.toBe("20");
    expect(discounted.grandTotal.toString()).not.toBe("320");
  });

  it("records discountById from the acting user", async () => {
    const order = await makeOrder(4);
    const discounted = await ownerCaller.order.applyDiscount({
      orderId: order.id,
      type: "PERCENT",
      value: 10,
      reason: "Loyalty",
    });
    expect(discounted.discountById).toBe(owner.id);

    // A different operator's id is recorded when they apply it.
    const order2 = await makeOrder(4);
    const byCashier = await cashierCaller.order.applyDiscount({
      orderId: order2.id,
      type: "FLAT",
      value: 20,
      reason: "Regular",
    });
    expect(byCashier.discountById).toBe(cashier.id);
  });

  it("rejects a flat discount exceeding the subtotal", async () => {
    const order = await makeOrder(4); // subtotal 400
    await expect(
      ownerCaller.order.applyDiscount({
        orderId: order.id,
        type: "FLAT",
        value: 500,
        reason: "Too big",
      }),
    ).rejects.toThrow(/exceeds the order subtotal/);
  });

  it("rejects a percentage over 100", async () => {
    const order = await makeOrder(4);
    await expect(
      ownerCaller.order.applyDiscount({
        orderId: order.id,
        type: "PERCENT",
        value: 150,
        reason: "Impossible",
      }),
    ).rejects.toThrow();
  });

  it("rejects discounting a PAID order", async () => {
    const order = await makeOrder(4);
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });
    await expect(
      ownerCaller.order.applyDiscount({
        orderId: order.id,
        type: "PERCENT",
        value: 10,
        reason: "Too late",
      }),
    ).rejects.toThrow(/Cannot discount a PAID order/);
  });

  it("rejects discounting a CANCELLED order", async () => {
    const order = await makeOrder(4);
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });
    await expect(
      ownerCaller.order.applyDiscount({
        orderId: order.id,
        type: "FLAT",
        value: 10,
        reason: "Too late",
      }),
    ).rejects.toThrow(/Cannot discount a CANCELLED order/);
  });

  it("forbids a WAITER from applying a discount", async () => {
    const order = await makeOrder(4);
    await expect(
      waiterCaller.order.applyDiscount({
        orderId: order.id,
        type: "PERCENT",
        value: 10,
        reason: "Nope",
      }),
    ).rejects.toThrow(/Requires one of roles/);
  });

  it("removeDiscount restores the original totals exactly", async () => {
    const order = await makeOrder(4);
    const before = {
      subtotal: order.subtotal.toString(),
      taxTotal: order.taxTotal.toString(),
      grandTotal: order.grandTotal.toString(),
    };

    await ownerCaller.order.applyDiscount({
      orderId: order.id,
      type: "PERCENT",
      value: 10,
      reason: "Loyalty",
    });

    const restored = await ownerCaller.order.removeDiscount({ orderId: order.id });

    expect(restored.subtotal.toString()).toBe(before.subtotal); // 400
    expect(restored.taxTotal.toString()).toBe(before.taxTotal); // 20
    expect(restored.grandTotal.toString()).toBe(before.grandTotal); // 420
    expect(restored.discountTotal.toString()).toBe("0");
    expect(restored.discountType).toBeNull();
    expect(restored.discountValue).toBeNull();
    expect(restored.discountReason).toBeNull();
    expect(restored.discountById).toBeNull();
  });

  it("flows a line-level discount into the order total", async () => {
    // Two lines of Samosa: qty 2 (₹200, no line discount) and qty 2 with a ₹30
    // line discount. lineTotal is stored net of the discount.
    //   line A net = 200,           tax = 10
    //   line B net = 200 − 30 = 170, tax = 8.50
    //   subtotal   = 370, taxTotal = 18.50, grand = 388.50
    const order = await ownerCaller.order.create({
      branchId,
      type: "DINE_IN",
      guestCount: 2,
      items: [
        { itemId: samosaId, quantity: 2 },
        { itemId: samosaId, quantity: 2, discountAmount: 30 },
      ],
    });

    expect(order.subtotal.toString()).toBe("370");
    expect(order.taxTotal.toString()).toBe("18.5");
    expect(order.grandTotal.toString()).toBe("388.5");

    const discountedLine = order.items.find(
      (i) => i.discountAmount.toString() === "30",
    );
    expect(discountedLine).toBeDefined();
    // lineTotal is net of the line discount + its own tax: 170 + 8.50 = 178.50
    expect(discountedLine!.lineTotal.toString()).toBe("178.5");

    console.log(`Line-level discount flows into totals:
      Line A (2×₹100):            net ₹200, tax ₹10
      Line B (2×₹100 − ₹30):      net ₹170, tax ₹8.50
      Subtotal:  ₹${order.subtotal.toString()}
      GST (5%):  ₹${order.taxTotal.toString()}
      Grand:     ₹${order.grandTotal.toString()}
    `);
  });

  it("rejects a line discount exceeding the line total", async () => {
    await expect(
      ownerCaller.order.create({
        branchId,
        type: "DINE_IN",
        guestCount: 1,
        items: [{ itemId: samosaId, quantity: 1, discountAmount: 500 }],
      }),
    ).rejects.toThrow(/exceeds line total/);
  });

  it("stacks a line discount and an order-level discount on the reduced base", async () => {
    // Line: qty 4 with ₹40 line discount → net 360, tax base starts at 360.
    // Then 10% order discount:
    //   subtotal      = 360
    //   discountTotal = 36
    //   taxable       = 324
    //   taxTotal      = 324 × 5% = 16.20
    //   grand         = 360 − 36 + 16.20 = 340.20
    const order = await ownerCaller.order.create({
      branchId,
      type: "DINE_IN",
      guestCount: 2,
      items: [{ itemId: samosaId, quantity: 4, discountAmount: 40 }],
    });
    expect(order.subtotal.toString()).toBe("360");

    const discounted = await ownerCaller.order.applyDiscount({
      orderId: order.id,
      type: "PERCENT",
      value: 10,
      reason: "Combo",
    });
    expect(discounted.discountTotal.toString()).toBe("36");
    expect(discounted.taxTotal.toString()).toBe("16.2");
    expect(discounted.grandTotal.toString()).toBe("340.2");
  });
});
