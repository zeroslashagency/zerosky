// zerosky — development seed
// Idempotent-ish: clears core tables, then seeds one tenant with a demo branch,
// staff for every role, a menu with categories/items/modifiers, and floor tables.

import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, TableState } from "../generated/client";

const prisma = new PrismaClient();

/** Password for every seeded dev account. Override with SEED_PASSWORD. */
const DEV_PASSWORD = process.env.SEED_PASSWORD ?? "zerosky123";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error("Refusing to run destructive seed in production without ALLOW_DESTRUCTIVE_SEED=true");
  }
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

  const starters = await prisma.category.create({ data: { menuId: menu.id, name: "Starters", sortOrder: 1 } });
  const mains = await prisma.category.create({ data: { menuId: menu.id, name: "Main Course", sortOrder: 2 } });
  const drinks = await prisma.category.create({ data: { menuId: menu.id, name: "Beverages", sortOrder: 3 } });
  const desserts = await prisma.category.create({ data: { menuId: menu.id, name: "Desserts", sortOrder: 4 } });

  const paneerTikka = await prisma.item.create({
    data: {
      categoryId: starters.id,
      name: "Paneer Tikka",
      description: "Char-grilled cottage cheese, mint chutney",
      price: 249,
      taxRate: 5,
      isVeg: true,
      imageUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&auto=format&fit=crop&q=60",
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
      imageUrl: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=60",
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
      imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=60",
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
      { categoryId: mains.id, name: "Garlic Naan", description: "Tandoor-baked, garlic butter", price: 59, taxRate: 5, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&auto=format&fit=crop&q=60", sortOrder: 3 },
      { categoryId: drinks.id, name: "Masala Chai", description: "Spiced milk tea, street style", price: 49, taxRate: 5, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=600&auto=format&fit=crop&q=60", sortOrder: 1 },
      { categoryId: drinks.id, name: "Fresh Lime Soda", description: "Sweet-salty lime, soda fizz", price: 79, taxRate: 12, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=600&auto=format&fit=crop&q=60", sortOrder: 2 },
      // +11 demo items so menu is never empty / shows related dish covers
      { categoryId: starters.id, name: "Veg Samosa", description: "Crispy pastry, spiced potato filling", price: 89, taxRate: 5, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=60", sortOrder: 2 },
      { categoryId: starters.id, name: "Chicken Tikka", description: "Tandoor chicken, smoky marinade", price: 299, taxRate: 5, isVeg: false, imageUrl: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&auto=format&fit=crop&q=60", sortOrder: 3 },
      { categoryId: starters.id, name: "Hara Bhara Kebab", description: "Spinach-pea tikki, mint chutney", price: 189, taxRate: 5, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&auto=format&fit=crop&q=60", sortOrder: 4 },
      { categoryId: mains.id, name: "Chicken Biryani", description: "Dum-cooked, saffron basmati", price: 349, taxRate: 5, isVeg: false, imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&auto=format&fit=crop&q=60", sortOrder: 4 },
      { categoryId: mains.id, name: "Veg Pulao", description: "Basmati, seasonal veg, ghee", price: 199, taxRate: 5, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&auto=format&fit=crop&q=60", sortOrder: 5 },
      { categoryId: mains.id, name: "Chole Bhature", description: "Punjabi chole, fluffy bhature", price: 179, taxRate: 5, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356c36?w=600&auto=format&fit=crop&q=60", sortOrder: 6 },
      { categoryId: mains.id, name: "Tandoori Roti", description: "Whole wheat, tandoor-baked", price: 39, taxRate: 5, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1626100861674-6013248b832a?w=600&auto=format&fit=crop&q=60", sortOrder: 7 },
      { categoryId: drinks.id, name: "Cold Coffee", description: "Iced, creamy, chocolate drizzle", price: 99, taxRate: 12, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop&q=60", sortOrder: 3 },
      { categoryId: drinks.id, name: "Mango Lassi", description: "Sweet yogurt, Alphonso mango", price: 89, taxRate: 5, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=600&auto=format&fit=crop&q=60", sortOrder: 4 },
      { categoryId: desserts.id, name: "Gulab Jamun", description: "Milk-solid dumplings, rose syrup (2 pcs)", price: 79, taxRate: 5, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=60", sortOrder: 1 },
      { categoryId: desserts.id, name: "Kulfi", description: "Malai kulfi, pistachio", price: 69, taxRate: 5, isVeg: true, imageUrl: "https://images.unsplash.com/photo-1488477181946-64290103bb53?w=600&auto=format&fit=crop&q=60", sortOrder: 2 },
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
