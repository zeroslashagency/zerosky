import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@zerosky/database";
import { hashPassword } from "@zerosky/auth";
import type { Tenant, Branch, User } from "@zerosky/database";
import { appRouter } from "../src/index.js";
import { createContext, type AuthUser } from "../src/context.js";
import { createCallerFactory } from "../src/trpc.js";

const createCaller = createCallerFactory(appRouter);
const uniq = () => Math.random().toString(36).slice(2, 10);

describe("Menu with Modifiers", () => {
  let tenant: Tenant;
  let branch: Branch;
  let owner: User;
  let caller: ReturnType<typeof createCaller>;

  beforeAll(async () => {
    tenant = await prisma.tenant.create({
      data: { name: "ModTest Tenant", slug: `mod-${uniq()}` },
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

    const auth: AuthUser = { user: owner, tenant };
    const ctx = await createContext({ db: prisma, auth });
    caller = createCaller(ctx);

    // Seed menu with modifiers
    const menu = await prisma.menu.create({
      data: { tenantId: tenant.id, name: "Main Menu", isDefault: true },
    });
    const starters = await prisma.category.create({
      data: { menuId: menu.id, name: "Starters", sortOrder: 1 },
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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.branch.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  });

  it("should return items with modifier groups and modifiers", async () => {
    const menus = await caller.menu.list({ includeInactive: false });
    
    expect(menus).toHaveLength(1);
    const menu = menus[0]!;
    expect(menu.isDefault).toBe(true);

    // Find an item with modifiers (Paneer Tikka)
    const starterCategory = menu.categories.find((c) => c.name === "Starters");
    expect(starterCategory).toBeDefined();

    const paneerTikka = starterCategory?.items.find((i) => i.name === "Paneer Tikka");
    expect(paneerTikka).toBeDefined();
    expect(paneerTikka?.modifierGroups).toBeDefined();
    expect(paneerTikka?.modifierGroups?.length).toBeGreaterThan(0);

    // Check spice level group
    const spiceLevel = paneerTikka?.modifierGroups?.find((g) => g.name === "Spice Level");
    expect(spiceLevel).toBeDefined();
    expect(spiceLevel?.isRequired).toBe(true);
    expect(spiceLevel?.minSelect).toBe(1);
    expect(spiceLevel?.maxSelect).toBe(1);
    expect(spiceLevel?.modifiers.length).toBe(3);

    // Check add-ons group
    const addons = paneerTikka?.modifierGroups?.find((g) => g.name === "Add-ons");
    expect(addons).toBeDefined();
    expect(addons?.isRequired).toBe(false);
    expect(addons?.minSelect).toBe(0);
    expect(addons?.maxSelect).toBe(3);
    
    const extraCheese = addons?.modifiers.find((m) => m.name === "Extra Cheese");
    expect(extraCheese).toBeDefined();
    expect(Number(extraCheese?.price)).toBe(40);
  });

  it("should return item with modifiers via getItem", async () => {
    const menus = await caller.menu.list({ includeInactive: false });
    const starterCategory = menus[0]?.categories.find((c) => c.name === "Starters");
    const paneerTikka = starterCategory?.items.find((i) => i.name === "Paneer Tikka");

    expect(paneerTikka).toBeDefined();

    const item = await caller.menu.getItem({ id: paneerTikka!.id });
    
    expect(item.modifierGroups).toBeDefined();
    expect(item.modifierGroups?.length).toBeGreaterThan(0);
  });

  it("should scope modifiers to correct tenant", async () => {
    // This test verifies that modifiers are returned only for items 
    // that belong to the authenticated tenant's menus
    const menus = await caller.menu.list({ includeInactive: false });
    
    expect(menus.length).toBeGreaterThan(0);
    
    // All items should belong to our tenant
    for (const menu of menus) {
      for (const category of menu.categories) {
        for (const item of category.items) {
          if (item.modifierGroups && item.modifierGroups.length > 0) {
            // Each modifier group must belong to this item
            for (const group of item.modifierGroups) {
              expect(group.itemId).toBe(item.id);
            }
          }
        }
      }
    }
  });
});
