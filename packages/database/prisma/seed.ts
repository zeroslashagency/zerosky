// zerosky — development seed
// Idempotent-ish: clears core tables, then seeds one tenant with a demo branch,
// staff for every role, a menu with categories/items/modifiers, and floor tables.

import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, TableState } from "../generated/client";

const prisma = new PrismaClient();

/** Password for every seeded dev account. Override with SEED_PASSWORD. */
const DEV_PASSWORD = process.env.SEED_PASSWORD ?? "zerosky123";

async function main() {
  // Clean in FK-safe order
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.kot.deleteMany();
  await prisma.order.deleteMany();
  await prisma.modifier.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.item.deleteMany();
  await prisma.category.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.table.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: {
      name: "Zerosky Demo Restaurant",
      slug: "zerosky-demo",
      gstin: "29ABCDE1234F1Z5",
      branches: {
        create: {
          name: "MG Road Outlet",
          code: "MGR",
          address: "MG Road, Bengaluru",
          phone: "+91 80 1234 5678",
          gstin: "29ABCDE1234F1Z5",
        },
      },
    },
    include: { branches: true },
  });

  const branch = tenant.branches[0]!;

  // Staff — one per role
  const staff: Array<{ email: string; name: string; role: UserRole; pin: string }> = [
    { email: "owner@zerosky.dev", name: "Aarav Owner", role: UserRole.OWNER, pin: "1111" },
    { email: "manager@zerosky.dev", name: "Meera Manager", role: UserRole.MANAGER, pin: "2222" },
    { email: "cashier@zerosky.dev", name: "Kabir Cashier", role: UserRole.CASHIER, pin: "3333" },
    { email: "waiter@zerosky.dev", name: "Diya Waiter", role: UserRole.WAITER, pin: "4444" },
    { email: "kitchen@zerosky.dev", name: "Rohan Kitchen", role: UserRole.KITCHEN, pin: "5555" },
  ];
  // Real bcrypt hash of DEV_PASSWORD so auth.login can actually authenticate.
  // A placeholder string here silently makes every password comparison fail.
  const devPasswordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  // PINs are hashed too (cost 10, matching hashPin() in @zerosky/auth). Storing
  // them in plaintext made the users table a credential dump.
  const staffWithHashes = await Promise.all(
    staff.map(async (s) => ({
      tenantId: tenant.id,
      email: s.email,
      name: s.name,
      role: s.role,
      pinHash: await bcrypt.hash(s.pin, 10),
      passwordHash: devPasswordHash,
    })),
  );
  await prisma.user.createMany({ data: staffWithHashes });

  // Menu → categories → items → modifiers
  const menu = await prisma.menu.create({
    data: { tenantId: tenant.id, name: "Main Menu", isDefault: true },
  });

  const starters = await prisma.category.create({
    data: { menuId: menu.id, name: "Starters", sortOrder: 1 },
  });
  const mains = await prisma.category.create({
    data: { menuId: menu.id, name: "Main Course", sortOrder: 2 },
  });
  const drinks = await prisma.category.create({
    data: { menuId: menu.id, name: "Beverages", sortOrder: 3 },
  });

  const paneerTikka = await prisma.item.create({
    data: {
      categoryId: starters.id,
      name: "Paneer Tikka",
      description: "Char-grilled cottage cheese, mint chutney",
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
          { name: "Mint Chutney", price: 20, sortOrder: 3 },
        ],
      },
    },
  });

  const butterChicken = await prisma.item.create({
    data: {
      categoryId: mains.id,
      name: "Butter Chicken",
      description: "Tomato-cream gravy, signature dish",
      price: 349,
      taxRate: 5,
      isVeg: false,
      sortOrder: 1,
    },
  });

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

  const dalMakhani = await prisma.item.create({
    data: {
      categoryId: mains.id,
      name: "Dal Makhani",
      description: "Slow-cooked black lentils",
      price: 229,
      taxRate: 5,
      isVeg: true,
      sortOrder: 2,
    },
  });

  await prisma.modifierGroup.create({
    data: {
      itemId: dalMakhani.id,
      name: "Portion Size",
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      sortOrder: 1,
      modifiers: {
        create: [
          { name: "Half", price: -80, sortOrder: 1 },
          { name: "Full", isDefault: true, sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.item.createMany({
    data: [
      { categoryId: mains.id, name: "Garlic Naan", price: 59, taxRate: 5, isVeg: true, sortOrder: 3 },
      { categoryId: drinks.id, name: "Masala Chai", price: 49, taxRate: 5, isVeg: true, sortOrder: 1 },
      { categoryId: drinks.id, name: "Fresh Lime Soda", price: 79, taxRate: 12, isVeg: true, sortOrder: 2 },
    ],
  });

  // Floor tables
  await prisma.table.createMany({
    data: [
      { branchId: branch.id, name: "T1", section: "Main Hall", seats: 2 },
      { branchId: branch.id, name: "T2", section: "Main Hall", seats: 4 },
      { branchId: branch.id, name: "T3", section: "Main Hall", seats: 4 },
      { branchId: branch.id, name: "P1", section: "Patio", seats: 6, state: TableState.RESERVED },
    ],
  });

  const [itemCount, tableCount, userCount] = await Promise.all([
    prisma.item.count(),
    prisma.table.count(),
    prisma.user.count(),
  ]);

  console.log(
    `Seeded: tenant "${tenant.name}", branch "${branch.name}", ${userCount} users, ${itemCount} items, ${tableCount} tables.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
