// @zerosky/print — full GST (tax) invoice template
// Includes seller/buyer GSTIN, per-item HSN, and a CGST/SGST or IGST breakdown
// grouped by tax rate, as required for a compliant tax invoice.

import { DocumentBuilder } from "../template.js";
import type { PrintDocument } from "../template.js";
import type { InvoiceData, TemplateOptions } from "../types.js";
import {
  computeTotals,
  formatMoney,
  isInterState,
  itemRow,
  stateCodeFromGstin,
  twoCol,
} from "../formatter.js";

function formatTimestamp(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Build a GST tax invoice document. */
export function buildInvoice(data: InvoiceData, options: TemplateOptions): PrintDocument {
  const locale = options.locale ?? "en-IN";
  const doc = new DocumentBuilder(options.width);
  const cols = doc.columns;

  const sellerState = data.outlet.stateCode ?? stateCodeFromGstin(data.outlet.gstin);
  const buyerState = data.customer?.stateCode ?? stateCodeFromGstin(data.customer?.gstin);
  const interState = isInterState(sellerState, buyerState);
  const totals = computeTotals(data.items, interState, data.discountTotal ?? 0);

  doc.title("TAX INVOICE", { height: 2 });
  doc.line(data.outlet.name, { align: "center", bold: true });
  for (const addr of data.outlet.addressLines ?? []) doc.line(addr, { align: "center" });
  if (data.outlet.gstin) doc.line(`GSTIN: ${data.outlet.gstin}`, { align: "center" });
  doc.divider();

  doc.line(twoCol(`Invoice: ${data.invoiceNumber}`, formatTimestamp(data.createdAt, locale), cols));
  if (data.customer?.name) doc.line(`Buyer: ${data.customer.name}`);
  if (data.customer?.gstin) doc.line(`Buyer GSTIN: ${data.customer.gstin}`);
  for (const addr of data.customer?.addressLines ?? []) doc.line(addr);
  doc.line(`Supply: ${interState ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"}`);
  doc.divider();

  doc.line(itemRow("Item/HSN", "Qty", "Rate", "Amount", cols)[0] ?? "");
  doc.divider();

  for (const item of data.items) {
    const amount = formatMoney(item.unitPrice * item.quantity, locale);
    const rate = formatMoney(item.unitPrice, locale);
    const rows = itemRow(item.name, String(item.quantity), rate, amount, cols);
    for (const row of rows) doc.line(row);
    const hsnLine = item.hsn ? `  HSN: ${item.hsn}` : "";
    if (hsnLine) doc.line(twoCol(hsnLine, `GST ${item.taxRate}%`, cols));
  }
  doc.divider();

  doc.line(twoCol("Taxable Value", formatMoney(totals.taxableTotal, locale), cols));

  // Per-rate tax breakdown.
  for (const row of totals.byRate) {
    const label = row.hsn ? `[${row.hsn}] ${row.taxRate}%` : `${row.taxRate}%`;
    doc.line(twoCol(`Taxable @ ${label}`, formatMoney(row.taxable, locale), cols));
    if (row.igst > 0) {
      doc.line(twoCol(`  IGST ${row.taxRate}%`, formatMoney(row.igst, locale), cols));
    } else {
      const half = row.taxRate / 2;
      doc.line(twoCol(`  CGST ${half}%`, formatMoney(row.cgst, locale), cols));
      doc.line(twoCol(`  SGST ${half}%`, formatMoney(row.sgst, locale), cols));
    }
  }

  if (totals.discountTotal > 0) {
    doc.line(twoCol("Discount", `-${formatMoney(totals.discountTotal, locale)}`, cols));
  }
  if (interState) {
    doc.line(twoCol("Total IGST", formatMoney(totals.igstTotal, locale), cols));
  } else {
    doc.line(twoCol("Total CGST", formatMoney(totals.cgstTotal, locale), cols));
    doc.line(twoCol("Total SGST", formatMoney(totals.sgstTotal, locale), cols));
  }
  if (totals.roundOff !== 0) {
    const sign = totals.roundOff > 0 ? "+" : "-";
    doc.line(twoCol("Round Off", `${sign}${formatMoney(Math.abs(totals.roundOff), locale)}`, cols));
  }

  doc.divider("=");
  doc.line(twoCol("GRAND TOTAL", formatMoney(totals.grandTotal, locale), cols), { bold: true });
  doc.divider("=");

  doc.feed(1);
  doc.line(data.footerNote ?? "This is a computer-generated invoice.", { align: "center" });
  doc.feed(1).cut();

  return doc.build();
}
