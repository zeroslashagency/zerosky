// @zerosky/print — customer receipt template (58mm / 80mm)
// Renders a tax-inclusive receipt with a compact GST summary.

import { DocumentBuilder } from "../template.js";
import type { PrintDocument } from "../template.js";
import type { ReceiptData, TemplateOptions } from "../types.js";
import {
  computeTotals,
  formatMoney,
  isInterState,
  itemRow,
  stateCodeFromGstin,
  twoCol,
} from "../formatter.js";

function formatTimestamp(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Build a customer receipt document from order data. */
export function buildReceipt(data: ReceiptData, options: TemplateOptions): PrintDocument {
  const locale = options.locale ?? "en-IN";
  const doc = new DocumentBuilder(options.width);
  const cols = doc.columns;

  const sellerState = data.outlet.stateCode ?? stateCodeFromGstin(data.outlet.gstin);
  // Use buyer state when available (e.g. B2B receipt reprint), fall back to
  // intra-state for walk-in customers. This matches invoice.ts:27-30.
  const buyerState = data.customer?.stateCode ?? stateCodeFromGstin(data.customer?.gstin) ?? null;
  const interState = buyerState ? isInterState(sellerState, buyerState) : false;
  const totals = computeTotals(data.items, interState, data.discountTotal ?? 0);

  doc.title(data.outlet.name, { height: 2 });
  for (const addr of data.outlet.addressLines ?? []) doc.line(addr, { align: "center" });
  if (data.outlet.phone) doc.line(`Ph: ${data.outlet.phone}`, { align: "center" });
  if (data.outlet.gstin) doc.line(`GSTIN: ${data.outlet.gstin}`, { align: "center" });
  doc.divider();

  doc.line(twoCol(`Bill: ${data.orderNumber}`, formatTimestamp(data.createdAt, locale), cols));
  if (data.tableName) doc.line(`Table: ${data.tableName}`);
  if (data.cashierName) doc.line(`Cashier: ${data.cashierName}`);
  doc.divider();

  doc.line(itemRow("Item", "Qty", "Rate", "Amount", cols)[0] ?? "");
  doc.divider();

  for (const item of data.items) {
    const amount = formatMoney(item.unitPrice * item.quantity, locale);
    const rate = formatMoney(item.unitPrice, locale);
    for (const row of itemRow(item.name, String(item.quantity), rate, amount, cols)) {
      doc.line(row);
    }
    for (const mod of item.modifiers ?? []) {
      doc.line(`  + ${mod.name}`);
    }
  }
  doc.divider();

  doc.line(twoCol("Subtotal", formatMoney(totals.subtotal, locale), cols));
  if (totals.discountTotal > 0) {
    doc.line(twoCol("Discount", `-${formatMoney(totals.discountTotal, locale)}`, cols));
  }

  // GST summary grouped by rate.
  for (const row of totals.byRate) {
    if (row.igst > 0) {
      doc.line(twoCol(`IGST ${row.taxRate}%`, formatMoney(row.igst, locale), cols));
    } else {
      const half = row.taxRate / 2;
      doc.line(twoCol(`CGST ${half}%`, formatMoney(row.cgst, locale), cols));
      doc.line(twoCol(`SGST ${half}%`, formatMoney(row.sgst, locale), cols));
    }
  }

  if (totals.roundOff !== 0) {
    const sign = totals.roundOff > 0 ? "+" : "-";
    doc.line(twoCol("Round Off", `${sign}${formatMoney(Math.abs(totals.roundOff), locale)}`, cols));
  }
  doc.divider("=");
  doc.line(twoCol("TOTAL", formatMoney(totals.grandTotal, locale), cols), { bold: true });
  doc.divider("=");

  doc.feed(1);
  doc.line(data.footerNote ?? "Thank you! Visit again.", { align: "center" });
  doc.feed(1).cut();

  return doc.build();
}
