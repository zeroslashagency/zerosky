// @zerosky/print — shared domain types
// Plain, serializable shapes decoupled from Prisma so templates can be rendered
// from either DB rows or ad-hoc data (e.g. offline queue payloads).

import type { PaperWidth } from "./escpos.js";

/** A single line item on a receipt/invoice. */
export interface PrintLineItem {
  name: string;
  quantity: number;
  /** Unit price, tax-inclusive, in major currency units (e.g. rupees). */
  unitPrice: number;
  /** GST rate as a percentage, e.g. 5, 12, 18. */
  taxRate: number;
  /** Optional HSN/SAC code for GST invoices. */
  hsn?: string;
  /** Modifier snapshots, printed beneath the item. */
  modifiers?: Array<{ name: string; price: number }>;
  notes?: string;
  /**
   * Per-line discount in major units, mirroring OrderItem.discountAmount.
   * When present, lineGross() is net of this amount and computeTotals()
   * derives the grand total from net lines. Pass order.discountTotal as
   * discountTotal only for order-level discounts not already reflected per
   * line — otherwise grandTotal will drift (double subtraction).
   * SKU uniqueness is a database constraint (InventoryItem @@unique), not a
   * print concern.
   */
  discountAmount?: number;
}

/** Seller/outlet details printed in the header and used for GST logic. */
export interface OutletInfo {
  name: string;
  addressLines?: string[];
  phone?: string;
  gstin?: string;
  /** State code (first 2 digits of GSTIN). Used to decide CGST/SGST vs IGST. */
  stateCode?: string;
}

/** Buyer details for a full GST (tax) invoice. */
export interface CustomerInfo {
  name?: string;
  gstin?: string;
  stateCode?: string;
  addressLines?: string[];
  phone?: string;
}

/** Common options shared by all templates. */
export interface TemplateOptions {
  width: PaperWidth;
  /** ISO currency code; only used for label text. Amounts stay numeric. */
  currency?: string;
  /** Locale for number formatting. Defaults to en-IN. */
  locale?: string;
}

/** Input for a customer receipt. */
export interface ReceiptData {
  outlet: OutletInfo;
  /** When present, used to decide IGST vs CGST/SGST (matches invoice logic). */
  customer?: CustomerInfo;
  orderNumber: string;
  tableName?: string;
  createdAt: Date;
  items: PrintLineItem[];
  /** Order-level discount in major units. Sums OrderItem.discountAmount when set. */
  discountTotal?: number;
  cashierName?: string;
  footerNote?: string;
}

/** Input for a Kitchen Order Ticket. */
export interface KotData {
  kotNumber: string;
  orderNumber: string;
  station?: string;
  tableName?: string;
  orderType: string;
  createdAt: Date;
  items: Array<Pick<PrintLineItem, "name" | "quantity" | "modifiers" | "notes">>;
}

/** Input for a full GST invoice. */
export interface InvoiceData {
  outlet: OutletInfo;
  customer?: CustomerInfo;
  invoiceNumber: string;
  createdAt: Date;
  items: PrintLineItem[];
  discountTotal?: number;
  footerNote?: string;
}
