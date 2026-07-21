// @zerosky/print — public API
// ESC/POS thermal printing for zerosky POS: drivers, GST-aware templates,
// a retrying print queue, and printer discovery.

export * from "./escpos.js";
export * from "./formatter.js";
export * from "./template.js";
export * from "./types.js";
export * from "./queue.js";
export * from "./discovery.js";

export { buildReceipt } from "./templates/receipt.js";
export { buildKot } from "./templates/kot.js";
export { buildInvoice } from "./templates/invoice.js";

import { renderToEscPos } from "./template.js";
import type { TemplateOptions } from "./types.js";
import type { ReceiptData, KotData, InvoiceData } from "./types.js";
import { buildReceipt } from "./templates/receipt.js";
import { buildKot } from "./templates/kot.js";
import { buildInvoice } from "./templates/invoice.js";

/** Render a receipt straight to ESC/POS bytes. */
export function renderReceipt(data: ReceiptData, options: TemplateOptions): Uint8Array {
  return renderToEscPos(buildReceipt(data, options));
}

/** Render a KOT straight to ESC/POS bytes. */
export function renderKot(data: KotData, options: TemplateOptions): Uint8Array {
  return renderToEscPos(buildKot(data, options));
}

/** Render a GST invoice straight to ESC/POS bytes. */
export function renderInvoice(data: InvoiceData, options: TemplateOptions): Uint8Array {
  return renderToEscPos(buildInvoice(data, options));
}
