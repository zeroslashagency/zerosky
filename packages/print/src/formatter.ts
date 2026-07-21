// @zerosky/print — GST computation + text layout helpers
// Pure functions: no I/O, fully unit-testable. Templates compose these.

import type { PrintLineItem } from "./types.js";

/**
 * Round to 2 decimals using half-up rounding, avoiding binary float drift
 * (e.g. 1.005 → 1.01). Returns a Number, not a string.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Format a numeric amount with grouping and 2 decimals (default en-IN). */
export function formatMoney(value: number, locale = "en-IN"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(value));
}

/** Validate an Indian GSTIN (15 chars: 2 state + 10 PAN + 3 checks). */
export function isValidGstin(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
}

/** Extract the 2-digit state code from a GSTIN, or null if malformed. */
export function stateCodeFromGstin(gstin: string | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.slice(0, 2);
  return /^[0-9]{2}$/.test(code) ? code : null;
}

/**
 * A tax-inclusive line price decomposed into base + GST components.
 * For intra-state supply, gst splits evenly into CGST + SGST; for
 * inter-state supply the whole amount is IGST.
 */
export interface TaxComponents {
  taxRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

/**
 * Decompose a tax-INCLUSIVE gross amount into taxable base and GST parts.
 * @param interState when true, tax is charged as IGST; otherwise CGST+SGST.
 */
export function splitInclusiveTax(gross: number, taxRate: number, interState: boolean): TaxComponents {
  const rate = taxRate / 100;
  const taxable = round2(gross / (1 + rate));
  const tax = round2(gross - taxable);
  if (interState) {
    return { taxRate, taxable, cgst: 0, sgst: 0, igst: tax, total: round2(gross) };
  }
  const half = round2(tax / 2);
  return {
    taxRate,
    taxable,
    cgst: half,
    // Assign remainder to SGST so cgst+sgst === tax exactly.
    sgst: round2(tax - half),
    igst: 0,
    total: round2(gross),
  };
}

/** Gross (tax-inclusive) line total for an item. */
export function lineGross(item: PrintLineItem): number {
  const base = item.unitPrice * item.quantity;
  const mods = (item.modifiers ?? []).reduce((sum, m) => sum + m.price, 0) * item.quantity;
  return round2(base + mods);
}

/** Per-tax-rate subtotal row for the GST summary block. */
export interface TaxSummaryRow extends TaxComponents {
  hsn?: string;
}

/** Aggregated totals across all line items. */
export interface BillTotals {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  grandTotal: number;
  /** Rounding adjustment applied to reach a whole-rupee grand total. */
  roundOff: number;
  /** GST summary grouped by tax rate. */
  byRate: TaxSummaryRow[];
}

/**
 * Compute full bill totals from tax-inclusive line items.
 * @param interState decides CGST/SGST vs IGST split.
 * @param discountTotal order-level discount, applied proportionally is NOT
 *        done here — discount is treated as a flat reduction of the grand
 *        total after tax for simplicity; taxable base uses gross-of-discount.
 * @param roundToWhole when true, round grand total to nearest whole unit.
 */
export function computeTotals(
  items: PrintLineItem[],
  interState: boolean,
  discountTotal = 0,
  roundToWhole = true,
): BillTotals {
  const byRateMap = new Map<number, TaxSummaryRow>();
  let subtotal = 0;
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  for (const item of items) {
    const gross = lineGross(item);
    subtotal = round2(subtotal + gross);
    const comp = splitInclusiveTax(gross, item.taxRate, interState);
    taxableTotal = round2(taxableTotal + comp.taxable);
    cgstTotal = round2(cgstTotal + comp.cgst);
    sgstTotal = round2(sgstTotal + comp.sgst);
    igstTotal = round2(igstTotal + comp.igst);

    const existing = byRateMap.get(item.taxRate);
    if (existing) {
      existing.taxable = round2(existing.taxable + comp.taxable);
      existing.cgst = round2(existing.cgst + comp.cgst);
      existing.sgst = round2(existing.sgst + comp.sgst);
      existing.igst = round2(existing.igst + comp.igst);
      existing.total = round2(existing.total + comp.total);
    } else {
      byRateMap.set(item.taxRate, { ...comp, hsn: item.hsn });
    }
  }

  const taxTotal = round2(cgstTotal + sgstTotal + igstTotal);
  const netBeforeRound = round2(subtotal - discountTotal);
  const grandTotal = roundToWhole ? Math.round(netBeforeRound) : netBeforeRound;
  const roundOff = round2(grandTotal - netBeforeRound);

  return {
    subtotal,
    discountTotal: round2(discountTotal),
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    taxTotal,
    grandTotal,
    roundOff,
    byRate: [...byRateMap.values()].sort((a, b) => a.taxRate - b.taxRate),
  };
}

/**
 * Decide whether a supply is inter-state (→ IGST) by comparing the seller's
 * and buyer's state codes. If either is unknown, defaults to intra-state.
 */
export function isInterState(sellerState: string | null | undefined, buyerState: string | null | undefined): boolean {
  if (!sellerState || !buyerState) return false;
  return sellerState !== buyerState;
}

// ─────────────────────────────────────────────────────────────
// Text layout helpers (monospace column arithmetic)
// ─────────────────────────────────────────────────────────────

/** Truncate/pad a string to an exact width. */
export function fit(value: string, width: number): string {
  if (value.length === width) return value;
  if (value.length > width) return value.slice(0, width);
  return value.padEnd(width, " ");
}

/** A left column and right column justified to the two edges of `width`. */
export function twoCol(left: string, right: string, width: number): string {
  const space = width - right.length;
  if (space <= 0) return right.slice(0, width);
  return fit(left, space) + right;
}

/** Center a string within `width` (no padding beyond width). */
export function center(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, width);
  const totalPad = width - value.length;
  const left = Math.floor(totalPad / 2);
  return " ".repeat(left) + value + " ".repeat(totalPad - left);
}

/** A full-width divider line of the given character. */
export function divider(width: number, char = "-"): string {
  return char.repeat(width);
}

/**
 * Lay out a 4-column item row: name | qty | rate | amount, right-aligning
 * the numeric columns. Wraps the name onto continuation lines when it exceeds
 * the available name column.
 */
export function itemRow(name: string, qty: string, rate: string, amount: string, width: number): string[] {
  const qtyW = 3;
  const rateW = Math.max(7, rate.length);
  const amtW = Math.max(8, amount.length);
  const nameW = width - qtyW - rateW - amtW - 3; // 3 single-space gaps
  if (nameW < 4) {
    // Too narrow for 4 columns; fall back to two lines.
    return [name.slice(0, width), twoCol(`${qty} x ${rate}`, amount, width)];
  }
  const lines: string[] = [];
  const first =
    fit(name.slice(0, nameW), nameW) + " " + fit(qty, qtyW) + " " + rate.padStart(rateW) + " " + amount.padStart(amtW);
  lines.push(first);
  for (let i = nameW; i < name.length; i += nameW) {
    lines.push(name.slice(i, i + nameW));
  }
  return lines;
}
