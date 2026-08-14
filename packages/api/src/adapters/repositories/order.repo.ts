import type { PrismaClient } from "@zerosky/database";
import type { IOrderRepository, OrderLean } from "../../core/ports/order.port.js";

/** Prisma-backed lean order list. No OrderItem join — _count only. */
export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly db: PrismaClient) {}

  async listLean(
    branchId: string,
    tenantId: string,
    statusFilter: string | string[] | undefined,
    limit: number,
  ): Promise<OrderLean[]> {
    const statusClause = Array.isArray(statusFilter)
      ? { in: statusFilter }
      : statusFilter
        ? statusFilter
        : undefined;

    const rows = await this.db.order.findMany({
      where: {
        branchId,
        branch: { tenantId },
        ...(statusClause ? { status: statusClause as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        branchId: true,
        tableId: true,
        orderNumber: true,
        type: true,
        status: true,
        subtotal: true,
        taxTotal: true,
        discountTotal: true,
        grandTotal: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    });

    return rows.map((r) => ({
      ...r,
      itemCount: r._count.items,
      items: Array.from({ length: r._count.items }, () => ({ id: "" })),
    }));
  }
}
