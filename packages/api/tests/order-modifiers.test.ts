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

describe("Order with Modifiers", () => {
  let tenant: Tenant;
  let branch: Branch;
  let owner: User;
  let caller: ReturnType<typeof createCaller>;
  let branchId: string;
  let butterChickenId: string;
  let paneerTikkaId: string;

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: "OrderModTest Tenant", slug: `ordmod-${uniq()}` },
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

    branchId = branch.id;

    const auth: AuthUser = { user: owner, tenant };
    const ctx = await createContext({ db: prisma, auth });
    caller = createCaller(ctx);

    // Seed menu with items and modifiers
    const menu = await prisma.menu.create({
      data: { tenantId: tenant.id, name: "Main Menu", isDefault: true },
    });
    const starters = await prisma.category.create({
      data: { menuId: menu.id, name: "Starters", sortOrder: 1 },
    });
    const mains = await prisma.category.create({
      data: { menuId: menu.id, name: "Main Course", sortOrder: 2 },
    });

    const paneerTikka = await prisma.item.create({
      data: {
        categoryId: starters.id,
        name: "Paneer Tikka",
        description: "Char-grilled cottage cheese",
        price: 249,
        taxRate: 5,
        isVeg: true,
        sortOrder: 1,
      },
    });
    paneerTikkaId = paneerTikka.id;

    await prisma.modifierGroup.create({
      data: {
        itemId: paneerTikka.id,
        name: "Spice Level",
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 1,
        modifiers: {
          create: [
            { name: "Mild", isDefault: true, sortOrder: 1 },
            { name: "Medium", sortOrder: 2 },
            { name: "Hot", sortOrder: 3 },
          ],
        },
      },
    });

    await prisma.modifierGroup.create({
      data: {
        itemId: paneerTikka.id,
        name: "Add-ons",
        minSelect: 0,
        maxSelect: 3,
        sortOrder: 2,
        modifiers: {
          create: [
            { name: "Extra Cheese", price: 40, sortOrder: 1 },
            { name: "Extra Butter", price: 30, sortOrder: 2 },
          ],
        },
      },
    });

    const butterChicken = await prisma.item.create({
      data: {
        categoryId: mains.id,
        name: "Butter Chicken",
        description: "Tomato-cream gravy",
        price: 349,
        taxRate: 5,
        isVeg: false,
        sortOrder: 1,
      },
    });
    butterChickenId = butterChicken.id;

    await prisma.modifierGroup.create({
      data: {
        itemId: butterChicken.id,
        name: "Portion Size",
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 1,
        modifiers: {
          create: [
            { name: "Half", price: -100, sortOrder: 1 },
            { name: "Full", isDefault: true, sortOrder: 2 },
            { name: "Family (Serves 4)", price: 200, sortOrder: 3 },
          ],
        },
      },
    });

    await prisma.modifierGroup.create({
      data: {
        itemId: butterChicken.id,
        name: "Spice Level",
        minSelect: 1,
        maxSelect: 1,
        isRequired: true,
        sortOrder: 2,
        modifiers: {
          create: [
            { name: "Mild", sortOrder: 1 },
            { name: "Medium", isDefault: true, sortOrder: 2 },
            { name: "Hot", sortOrder: 3 },
          ],
        },
      },
    });

    await prisma.modifierGroup.create({
      data: {
        itemId: butterChicken.id,
        name: "Add-ons",
        minSelect: 0,
        maxSelect: 3,
        sortOrder: 3,
        modifiers: {
          create: [
            { name: "Extra Gravy", price: 50, sortOrder: 1 },
            { name: "Extra Butter", price: 30, sortOrder: 2 },
          ],
        },
      },
    });

    await prisma.item.create({
      data: {
        categoryId: mains.id,
        name: "Garlic Naan",
        price: 59,
        taxRate: 5,
        isVeg: true,
        sortOrder: 3,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.branch.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it("should create order with modifiers and compute correct totals", async () => {
    // Butter Chicken: Base ₹349, Full portion (no delta), Medium spice (no delta), Extra Gravy +₹50
    // Expected item total: (349 + 50) * 1 = 399
    // Tax at 5%: 399 * 0.05 = 19.95
    // Line total: 399 + 19.95 = 418.95

    const order = await caller.order.create({
      branchId,
      type: "DINE_IN",
      guestCount: 2,
      items: [
        {
          itemId: butterChickenId,
          quantity: 1,
          modifiers: [
            {
              groupId: "portion-group",
              groupName: "Portion Size",
              options: [{ id: "full-option", name: "Full", price: 0 }],
            },
            {
              groupId: "spice-group",
              groupName: "Spice Level",
              options: [{ id: "medium-option", name: "Medium", price: 0 }],
            },
            {
              groupId: "addons-group",
              groupName: "Add-ons",
              options: [{ id: "extra-gravy", name: "Extra Gravy", price: 50 }],
            },
          ],
        },
      ],
    });

    expect(order).toBeDefined();
    expect(order.items).toHaveLength(1);

    const orderItem = order.items[0]!;
    expect(orderItem.modifiers).toBeDefined();
    
    // Verify modifiers were persisted
    const modifiersArray = orderItem.modifiers as Array<{ name: string; price: number }>;
    expect(modifiersArray).toHaveLength(3);
    
    const extraGravy = modifiersArray.find((m) => m.name === "Extra Gravy");
    expect(extraGravy).toBeDefined();
    expect(extraGravy?.price).toBe(50);

    // Verify totals: base 349 + modifier 50 = 399 net
    const expectedNet = new Prisma.Decimal(399);
    const expectedTax = expectedNet.mul(5).div(100); // 19.95
    const expectedTotal = expectedNet.add(expectedTax); // 418.95

    expect(order.subtotal.toString()).toBe(expectedNet.toString());
    expect(order.taxTotal.toString()).toBe(expectedTax.toString());
    expect(order.grandTotal.toString()).toBe(expectedTotal.toString());

    // Report exact arithmetic for verification
    console.log(`Order totals with modifiers:
      Base price: ₹349
      Modifiers: +₹50 (Extra Gravy)
      Subtotal: ₹${order.subtotal.toString()}
      Tax (5%): ₹${order.taxTotal.toString()}
      Grand Total: ₹${order.grandTotal.toString()}
    `);
  });

  it("should create order with multiple modifier selections and quantity", async () => {
    // Paneer Tikka: Base ₹249, Mild spice (no delta), Extra Cheese +₹40, Extra Butter +₹30
    // Per item: 249 + 40 + 30 = 319
    // Quantity: 2
    // Net: 319 * 2 = 638
    // Tax at 5%: 638 * 0.05 = 31.90
    // Total: 638 + 31.90 = 669.90

    const order = await caller.order.create({
      branchId,
      type: "TAKEAWAY",
      guestCount: 1,
      items: [
        {
          itemId: paneerTikkaId,
          quantity: 2,
          modifiers: [
            {
              groupId: "spice-group",
              groupName: "Spice Level",
              options: [{ id: "mild-option", name: "Mild", price: 0 }],
            },
            {
              groupId: "addons-group",
              groupName: "Add-ons",
              options: [
                { id: "extra-cheese", name: "Extra Cheese", price: 40 },
                { id: "extra-butter", name: "Extra Butter", price: 30 },
              ],
            },
          ],
        },
      ],
    });

    expect(order).toBeDefined();
    expect(order.items).toHaveLength(1);

    const orderItem = order.items[0]!;
    expect(orderItem.quantity).toBe(2);
    
    const modifiersArray = orderItem.modifiers as Array<{ name: string; price: number }>;
    expect(modifiersArray.length).toBe(3); // Mild + Extra Cheese + Extra Butter

    const expectedNet = new Prisma.Decimal(638);
    const expectedTax = new Prisma.Decimal("31.90");
    const expectedTotal = new Prisma.Decimal("669.90");

    expect(order.subtotal.toString()).toBe(expectedNet.toString());
    expect(order.taxTotal.toString()).toBe(expectedTax.toString());
    expect(order.grandTotal.toString()).toBe(expectedTotal.toString());

    console.log(`Order with quantity and multiple modifiers:
      Base: ₹249, Modifiers: +₹70, Quantity: 2
      Subtotal: ₹${order.subtotal.toString()}
      Tax (5%): ₹${order.taxTotal.toString()}
      Grand Total: ₹${order.grandTotal.toString()}
    `);
  });

  it("should handle negative modifier price (Half portion)", async () => {
    // Butter Chicken Half: Base ₹349, Half portion -₹100, Medium spice (no delta)
    // Net: (349 - 100) * 1 = 249
    // Tax: 249 * 0.05 = 12.45
    // Total: 261.45

    const order = await caller.order.create({
      branchId,
      type: "DINE_IN",
      guestCount: 1,
      items: [
        {
          itemId: butterChickenId,
          quantity: 1,
          modifiers: [
            {
              groupId: "portion-group",
              groupName: "Portion Size",
              options: [{ id: "half-option", name: "Half", price: -100 }],
            },
            {
              groupId: "spice-group",
              groupName: "Spice Level",
              options: [{ id: "medium-option", name: "Medium", price: 0 }],
            },
          ],
        },
      ],
    });

    const expectedNet = new Prisma.Decimal(249);
    const expectedTax = new Prisma.Decimal("12.45");
    const expectedTotal = new Prisma.Decimal("261.45");

    expect(order.subtotal.toString()).toBe(expectedNet.toString());
    expect(order.taxTotal.toString()).toBe(expectedTax.toString());
    expect(order.grandTotal.toString()).toBe(expectedTotal.toString());

    console.log(`Order with negative modifier (Half portion):
      Base: ₹349, Half: -₹100
      Subtotal: ₹${order.subtotal.toString()}
      Tax (5%): ₹${order.taxTotal.toString()}
      Grand Total: ₹${order.grandTotal.toString()}
    `);
  });

  it("should create order without modifiers", async () => {
    // Garlic Naan: Base ₹59, no modifiers
    const menus = await caller.menu.list({ includeInactive: false });
    const mainCategory = menus[0]?.categories.find((c) => c.name === "Main Course");
    const garlicNaanId = mainCategory?.items.find((i) => i.name === "Garlic Naan")?.id!;

    const order = await caller.order.create({
      branchId,
      type: "TAKEAWAY",
      guestCount: 1,
      items: [
        {
          itemId: garlicNaanId,
          quantity: 3,
        },
      ],
    });

    const expectedNet = new Prisma.Decimal(177); // 59 * 3
    const expectedTax = new Prisma.Decimal("8.85"); // 177 * 0.05
    const expectedTotal = new Prisma.Decimal("185.85");

    expect(order.subtotal.toString()).toBe(expectedNet.toString());
    expect(order.taxTotal.toString()).toBe(expectedTax.toString());
    expect(order.grandTotal.toString()).toBe(expectedTotal.toString());

    const orderItem = order.items[0]!;
    expect(orderItem.modifiers).toBeNull();
  });

  it("should add items with modifiers to existing order", async () => {
    // Create initial order
    const order = await caller.order.create({
      branchId,
      type: "DINE_IN",
      guestCount: 2,
      items: [
        {
          itemId: butterChickenId,
          quantity: 1,
          modifiers: [
            {
              groupId: "portion-group",
              groupName: "Portion Size",
              options: [{ id: "full-option", name: "Full", price: 0 }],
            },
            {
              groupId: "spice-group",
              groupName: "Spice Level",
              options: [{ id: "medium-option", name: "Medium", price: 0 }],
            },
          ],
        },
      ],
    });

    // Add Paneer Tikka with modifiers
    const updated = await caller.order.addItems({
      orderId: order.id,
      items: [
        {
          itemId: paneerTikkaId,
          quantity: 1,
          modifiers: [
            {
              groupId: "spice-group",
              groupName: "Spice Level",
              options: [{ id: "hot-option", name: "Hot", price: 0 }],
            },
            {
              groupId: "addons-group",
              groupName: "Add-ons",
              options: [{ id: "extra-cheese", name: "Extra Cheese", price: 40 }],
            },
          ],
        },
      ],
    });

    expect(updated.items).toHaveLength(2);

    // First order: 349 + 5% = 366.45
    // Second item: (249 + 40) * 1 = 289, tax = 14.45, total = 303.45
    // Combined: subtotal = 638, tax = 31.90, total = 669.90
    const expectedNet = new Prisma.Decimal(638);
    const expectedTax = new Prisma.Decimal("31.90");
    const expectedTotal = new Prisma.Decimal("669.90");

    expect(updated.subtotal.toString()).toBe(expectedNet.toString());
    expect(updated.taxTotal.toString()).toBe(expectedTax.toString());
    expect(updated.grandTotal.toString()).toBe(expectedTotal.toString());
  });

  it("should compute GST on modified total, not base price", async () => {
    // This test ensures the GST base includes modifier deltas
    // Butter Chicken with Family portion: 349 + 200 = 549
    // Tax: 549 * 0.05 = 27.45
    // Total: 576.45

    const order = await caller.order.create({
      branchId,
      type: "DINE_IN",
      guestCount: 4,
      items: [
        {
          itemId: butterChickenId,
          quantity: 1,
          modifiers: [
            {
              groupId: "portion-group",
              groupName: "Portion Size",
              options: [{ id: "family-option", name: "Family (Serves 4)", price: 200 }],
            },
            {
              groupId: "spice-group",
              groupName: "Spice Level",
              options: [{ id: "hot-option", name: "Hot", price: 0 }],
            },
          ],
        },
      ],
    });

    const expectedNet = new Prisma.Decimal(549);
    const expectedTax = new Prisma.Decimal("27.45");
    const expectedTotal = new Prisma.Decimal("576.45");

    expect(order.subtotal.toString()).toBe(expectedNet.toString());
    expect(order.taxTotal.toString()).toBe(expectedTax.toString());
    expect(order.grandTotal.toString()).toBe(expectedTotal.toString());

    // The critical assertion: tax is computed on (base + modifiers), not just base
    const taxBase = order.subtotal;
    const computedTax = taxBase.mul(5).div(100);
    expect(order.taxTotal.toString()).toBe(computedTax.toString());

    console.log(`GST computed on modified total:
      Base: ₹349, Family portion: +₹200
      Tax base (subtotal): ₹${taxBase.toString()}
      GST at 5%: ₹${order.taxTotal.toString()}
      Grand Total: ₹${order.grandTotal.toString()}
      
      ✓ Tax is computed on ₹549 (base + modifiers), not ₹349 (base only)
    `);
  });
});
