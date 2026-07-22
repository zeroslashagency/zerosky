import { describe, it, expect } from "vitest";
import { buildReceipt } from "../src/templates/receipt.js";
import { buildKot } from "../src/templates/kot.js";
import { buildInvoice } from "../src/templates/invoice.js";
import { renderToText } from "../src/template.js";
import { renderReceipt, renderKot, renderInvoice } from "../src/index.js";
import type { ReceiptData, KotData, InvoiceData } from "../src/types.js";

const createdAt = new Date("2026-01-15T10:30:00Z");

const receiptData: ReceiptData = {
  outlet: {
    name: "Spice Villa",
    addressLines: ["12 MG Road", "Bengaluru"],
    phone: "080-1234",
    gstin: "29AAPFU0939F1ZV",
  },
  orderNumber: "ORD-101",
  tableName: "T1",
  createdAt,
  cashierName: "Asha",
  items: [
    { name: "Masala Dosa", quantity: 2, unitPrice: 120, taxRate: 5, modifiers: [{ name: "Extra chutney", price: 10 }] },
    { name: "Filter Coffee", quantity: 1, unitPrice: 40, taxRate: 5 },
  ],
  discountTotal: 5,
};

describe("buildReceipt", () => {
  it("includes outlet, order, items, and totals", () => {
    const text = renderToText(buildReceipt(receiptData, { width: 80 }));
    expect(text).toContain("Spice Villa");
    expect(text).toContain("ORD-101");
    expect(text).toContain("Masala Dosa");
    expect(text).toContain("Extra chutney");
    expect(text).toContain("TOTAL");
    expect(text).toContain("CGST 2.5%");
    expect(text).toContain("SGST 2.5%");
  });

  it("shows a discount line when a discount is present", () => {
    const text = renderToText(buildReceipt(receiptData, { width: 58 }));
    expect(text).toContain("Discount");
  });

  it("renders on 58mm without exceeding column width", () => {
    const doc = buildReceipt(receiptData, { width: 58 });
    const lines = renderToText(doc).split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it("uses a default footer when none provided", () => {
    const text = renderToText(buildReceipt(receiptData, { width: 80 }));
    expect(text).toContain("Thank you");
  });
});

const kotData: KotData = {
  kotNumber: "KOT-9",
  orderNumber: "ORD-101",
  station: "Tandoor",
  tableName: "T1",
  orderType: "DINE_IN",
  createdAt,
  items: [
    { name: "Paneer Tikka", quantity: 2, modifiers: [{ name: "Extra spicy", price: 0 }], notes: "No onion" },
    { name: "Naan", quantity: 3 },
  ],
};

describe("buildKot", () => {
  it("prints station, KOT number, and items without prices", () => {
    const text = renderToText(buildKot(kotData, { width: 80 }));
    expect(text).toContain("TANDOOR");
    expect(text).toContain("KOT-9");
    expect(text).toContain("2 x Paneer Tikka");
    expect(text).toContain("Extra spicy");
    expect(text).toContain("No onion");
    // No currency amounts on a KOT.
    expect(text).not.toContain("120.00");
  });

  it("defaults the station label to KITCHEN", () => {
    const text = renderToText(buildKot({ ...kotData, station: undefined }, { width: 58 }));
    expect(text).toContain("KITCHEN");
  });
});

const invoiceData: InvoiceData = {
  outlet: {
    name: "Spice Villa Pvt Ltd",
    addressLines: ["12 MG Road"],
    gstin: "29AAPFU0939F1ZV",
  },
  customer: {
    name: "Acme Corp",
    gstin: "27AAPFU0939F1ZV",
    addressLines: ["Mumbai"],
  },
  invoiceNumber: "INV-2026-001",
  createdAt,
  items: [
    { name: "Catering Platter", quantity: 10, unitPrice: 236, taxRate: 18, hsn: "996331" },
  ],
};

describe("buildInvoice", () => {
  it("marks inter-state supply and uses IGST when states differ", () => {
    const text = renderToText(buildInvoice(invoiceData, { width: 80 }));
    expect(text).toContain("TAX INVOICE");
    expect(text).toContain("29AAPFU0939F1ZV");
    expect(text).toContain("27AAPFU0939F1ZV");
    expect(text).toContain("Inter-State");
    expect(text).toContain("Total IGST");
    expect(text).toContain("996331");
    expect(text).toContain("GRAND TOTAL");
  });

  it("uses CGST/SGST for intra-state supply", () => {
    const intra: InvoiceData = {
      ...invoiceData,
      customer: { name: "Local Buyer", gstin: "29AAPFU0939F1ZV" },
    };
    const text = renderToText(buildInvoice(intra, { width: 80 }));
    expect(text).toContain("Intra-State");
    expect(text).toContain("Total CGST");
    expect(text).toContain("Total SGST");
  });

  it("handles a missing customer (treated intra-state)", () => {
    const text = renderToText(buildInvoice({ ...invoiceData, customer: undefined }, { width: 80 }));
    expect(text).toContain("Intra-State");
  });
});

describe("index render helpers", () => {
  it("render* helpers return non-empty ESC/POS byte arrays", () => {
    expect(renderReceipt(receiptData, { width: 80 }).length).toBeGreaterThan(0);
    expect(renderKot(kotData, { width: 80 }).length).toBeGreaterThan(0);
    expect(renderInvoice(invoiceData, { width: 80 }).length).toBeGreaterThan(0);
  });
});
