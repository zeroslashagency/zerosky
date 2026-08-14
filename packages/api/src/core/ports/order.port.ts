import type { Money } from "../money.js";

export type OrderStatusFilter = string | string[] | undefined;

/** Lean list row — what BillingQueue and Orders table actually need. */
export interface OrderLean {
  id: string;
  branchId: string;
  tableId: string | null;
  orderNumber: string;
  type: string;
  status: string;
  subtotal: Money;
  taxTotal: Money;
  discountTotal: Money;
  grandTotal: Money;
  createdAt: Date;
  /** Never loads OrderItems — just the count. */
  itemCount: number;
  /** Back-compat shim for callers reading items.length. */
  items: Array<{ id: string }>;
}

export interface IOrderRepository {
  listLean(
    branchId: string,
    tenantId: string,
    statusFilter: OrderStatusFilter,
    limit: number,
  ): Promise<OrderLean[]>;
}
