import { TRPCError } from "@trpc/server";
import { Decimal } from "../money.js";
import type { Money } from "../money.js";
import type { IItemRepository } from "../ports/item.port.js";

export type InputLine = {
  itemId: string;
  quantity: number;
  discountAmount?: number;
  seat?: number;
  notes?: string;
  modifiers?: Array<{ groupId: string; groupName: string; options: Array<{ id: string; name: string; price: number }> }>;
};

export interface PricedLine {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  taxRate: Money;
  discountAmount: Money;
  lineNet: Money;
  lineTax: Money;
  lineTotal: Money;
  seat?: number;
  notes?: string;
  modifiers?: Array<{ name: string; price: number }>;
}

/** Pure pricing service — no Prisma, no tRPC beyond TRPCError for domain violations. */
export class PricingService {
  constructor(private readonly items: IItemRepository) {}

  async priceLines(
    tenantId: string,
    lines: InputLine[],
  ): Promise<{ priced: PricedLine[]; subtotal: Money; taxTotal: Money; grandTotal: Money }> {
    const ids = [...new Set(lines.map((l) => l.itemId))];
    const found = await this.items.findByIdsForTenant(tenantId, ids);
    const byId = new Map(found.map((i) => [i.id, i]));

    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    const priced: PricedLine[] = [];

    for (const line of lines) {
      const item = byId.get(line.itemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: `Item ${line.itemId} not found for tenant.` });

      let modifierDelta = new Decimal(0);
      const modifierSnapshot: Array<{ name: string; price: number }> = [];
      if (line.modifiers) {
        for (const group of line.modifiers) {
          for (const opt of group.options) {
            modifierDelta = modifierDelta.add(opt.price);
            modifierSnapshot.push({ name: opt.name, price: opt.price });
          }
        }
      }

      const unitPriceWithModifiers = new Decimal(item.price).add(modifierDelta);
      const grossLine = unitPriceWithModifiers.mul(line.quantity);
      const lineDiscount = new Decimal(line.discountAmount ?? 0);
      if (lineDiscount.greaterThan(grossLine)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Line discount ₹${lineDiscount.toString()} exceeds line total ₹${grossLine.toString()}.`,
        });
      }

      const lineNet = grossLine.sub(lineDiscount);
      const taxRate = new Decimal(item.taxRate);
      const lineTax = lineNet.mul(taxRate).div(100);
      const lineTotal = lineNet.add(lineTax);

      subtotal = subtotal.add(lineNet);
      taxTotal = taxTotal.add(lineTax);

      priced.push({
        itemId: item.id,
        name: item.name,
        quantity: line.quantity,
        unitPrice: new Decimal(item.price),
        taxRate,
        discountAmount: lineDiscount,
        lineNet,
        lineTax,
        lineTotal,
        ...(line.seat !== undefined ? { seat: line.seat } : {}),
        ...(line.notes !== undefined ? { notes: line.notes } : {}),
        ...(modifierSnapshot.length > 0 ? { modifiers: modifierSnapshot } : {}),
      });
    }

    return { priced, subtotal, taxTotal, grandTotal: subtotal.add(taxTotal) };
  }

  /**
   * Recompute totals after an order-level discount on the reduced base.
   * factor = (subtotal - discountTotal)/subtotal per line so mixed tax rates stay correct.
   */
  static discountTotals(params: {
    lines: Array<{ lineNet: Money; taxRate: Money }>;
    value: number;
    type: "PERCENT" | "FLAT";
  }): { subtotal: Money; discountTotal: Money; taxTotal: Money; grandTotal: Money } {
    const subtotal = params.lines.reduce((s, l) => s.add(new Decimal(l.lineNet)), new Decimal(0));
    const raw = new Decimal(params.value);
    let discountTotal = params.type === "PERCENT" ? subtotal.mul(raw).div(100) : raw;
    discountTotal = discountTotal.toDecimalPlaces(2);
    if (discountTotal.greaterThan(subtotal)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Discount ₹${discountTotal.toString()} exceeds the order subtotal ₹${subtotal.toString()}.`,
      });
    }
    const factor = subtotal.isZero() ? new Decimal(0) : subtotal.sub(discountTotal).div(subtotal);
    const taxTotal = params.lines
      .reduce((sum, l) => sum.add(new Decimal(l.lineNet).mul(factor).mul(new Decimal(l.taxRate)).div(100)), new Decimal(0))
      .toDecimalPlaces(2);
    return { subtotal, discountTotal, taxTotal, grandTotal: subtotal.sub(discountTotal).add(taxTotal) };
  }
}
