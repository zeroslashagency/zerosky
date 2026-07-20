// zerosky — development seed
// Idempotent-ish: clears core tables, then seeds one tenant with a demo branch,
// staff for every role, a menu with categories/items/modifiers, and floor tables.

import { PrismaClient, UserRole, TableState } from "../generated/client";

const prisma = new PrismaClient();

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
  await prisma.user.createMany({
    data: staff.map((s) => ({
      tenantId: tenant.id,
      email: s.email,
      name: s.name,
      role: s.role,
      pin: s.pin,
      // Dev-only placeholder hash — replaced by real bcrypt in the auth batch.
      passwordHash: "$2a$10$devplaceholderhashnotforproduction00000000000000000",
    })),
  });

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
      name: "Spice level",
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      modifiers: {
        create: [
          { name: "Mild", isDefault: true },
          { name: "Medium" },
          { name: "Spicy" },
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
      modifiers: {
        create: [
          { name: "Extra cheese", price: 40 },
          { name: "Butter garlic", price: 25 },
        ],
      },
    },
  });

  await prisma.item.createMany({
    data: [
      { categoryId: mains.id, name: "Butter Chicken", description: "Tomato-cream gravy", price: 349, taxRate: 5, isVeg: false, sortOrder: 1 },
      { categoryId: mains.id, name: "Dal Makhani", description: "Slow-cooked black lentils", price: 229, taxRate: 5, isVeg: true, sortOrder: 2 },
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
