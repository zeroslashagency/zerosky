import type { Money } from "../money.js";

/** Minimal item projection needed for pricing. Keeps core free of Prisma. */
export interface ItemRecord {
  id: string;
  price: Money;
  taxRate: Money;
  name: string;
}

/** Port for menu item reads — pricing depends on this, not on Prisma. */
export interface IItemRepository {
  findByIdsForTenant(tenantId: string, ids: string[]): Promise<ItemRecord[]>;
}
