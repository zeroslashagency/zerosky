import type { PrismaClient } from "@zerosky/database";
import type { IItemRepository, ItemRecord } from "../../core/ports/item.port.js";

/** Prisma-backed implementation of IItemRepository. Thin adapter — no business logic. */
export class PrismaItemRepository implements IItemRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByIdsForTenant(tenantId: string, ids: string[]): Promise<ItemRecord[]> {
    const rows = await this.db.item.findMany({
      where: { id: { in: ids }, category: { menu: { tenantId } } },
      select: { id: true, price: true, taxRate: true, name: true },
    });
    return rows;
  }
}
