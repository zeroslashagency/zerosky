import { describe, it, expect } from "vitest";
import {
  round2,
  formatMoney,
  isValidGstin,
  stateCodeFromGstin,
  splitInclusiveTax,
  lineGross,
  computeTotals,
  isInterState,
  fit,
  twoCol,
  center,
  divider,
  itemRow,
} from "../src/formatter.js";
import type { PrintLineItem } from "../src/types.js";

describe("round2", () => {
  it("rounds to two decimals half-up", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.344)).toBe(2.34);
    expect(round2(2.345)).toBe(2.35);
  });
});

describe("formatMoney", () => {
  it("formats with two decimals and grouping", () => {
    expect(formatMoney(1234.5, "en-IN")).toBe("1,234.50");
    expect(formatMoney(0, "en-IN")).toBe("0.00");
  });
});

describe("isValidGstin", () => {
  it("accepts a well-formed GSTIN", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
  });
  it("rejects malformed GSTINs", () => {
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false); // too short
    expect(isValidGstin("abcdefghijklmno")).toBe(false);
    expect(isValidGstin("")).toBe(false);
  });
});

describe("stateCodeFromGstin", () => {
  it("extracts the leading state code", () => {
    expect(stateCodeFromGstin("27AAPFU0939F1ZV")).toBe("27");
  });
  it("returns null for missing or malformed input", () => {
    expect(stateCodeFromGstin(undefined)).toBeNull();
    expect(stateCodeFromGstin("X")).toBeNull();
    expect(stateCodeFromGstin("AB1234")).toBeNull();
  });
});

describe("splitInclusiveTax", () => {
  it("splits intra-state tax into equal CGST/SGST", () => {
    const c = splitInclusiveTax(105, 5, false);
    expect(c.taxable).toBe(100);
    expect(c.cgst).toBe(2.5);
    expect(c.sgst).toBe(2.5);
    expect(c.igst).toBe(0);
    expect(c.total).toBe(105);
  });

  it("charges the full tax as IGST inter-state", () => {
    const c = splitInclusiveTax(118, 18, true);
    expect(c.taxable).toBe(100);
    expect(c.igst).toBe(18);
    expect(c.cgst).toBe(0);
    expect(c.sgst).toBe(0);
  });

  it("keeps cgst+sgst exactly equal to total tax on odd splits", () => {
    const c = splitInclusiveTax(112.05, 12, false);
    expect(round2(c.cgst + c.sgst)).toBe(round2(c.total - c.taxable));
  });
});

describe("lineGross", () => {
  it("multiplies unit price by quantity and adds modifiers per unit", () => {
    const item: PrintLineItem = {
      name: "Pizza",
      quantity: 2,
      unitPrice: 100,
      taxRate: 5,
      modifiers: [{ name: "Extra cheese", price: 20 }],
    };
    // (100 + 20) * 2 = 240
    expect(lineGross(item)).toBe(240);
  });

  it("handles items without modifiers", () => {
    expect(lineGross({ name: "Tea", quantity: 3, unitPrice: 10, taxRate: 5 })).toBe(30);
  });
});

describe("computeTotals", () => {
  const items: PrintLineItem[] = [
    { name: "A", quantity: 1, unitPrice: 105, taxRate: 5 },
    { name: "B", quantity: 1, unitPrice: 118, taxRate: 18 },
  ];

  it("aggregates subtotal, tax, and grand total (intra-state)", () => {
    const t = computeTotals(items, false);
    expect(t.subtotal).toBe(223);
    expect(t.cgstTotal).toBe(round2(2.5 + 9));
    expect(t.sgstTotal).toBe(round2(2.5 + 9));
    expect(t.igstTotal).toBe(0);
    expect(t.grandTotal).toBe(223);
    expect(t.byRate).toHaveLength(2);
    expect(t.byRate[0]?.taxRate).toBe(5);
    expect(t.byRate[1]?.taxRate).toBe(18);
  });

  it("groups items sharing a tax rate", () => {
    const same: PrintLineItem[] = [
      { name: "A", quantity: 1, unitPrice: 105, taxRate: 5 },
      { name: "B", quantity: 1, unitPrice: 210, taxRate: 5 },
    ];
    const t = computeTotals(same, false);
    expect(t.byRate).toHaveLength(1);
    expect(t.byRate[0]?.total).toBe(315);
  });

  it("applies discount and computes round-off to whole units", () => {
    const t = computeTotals(items, false, 3.4);
    // net = 223 - 3.4 = 219.6 -> rounds to 220, roundOff = +0.4
    expect(t.grandTotal).toBe(220);
    expect(t.roundOff).toBe(0.4);
    expect(t.discountTotal).toBe(3.4);
  });

  it("can skip whole-unit rounding", () => {
    const t = computeTotals(items, false, 3.4, false);
    expect(t.grandTotal).toBe(219.6);
    expect(t.roundOff).toBe(0);
  });

  it("uses IGST when inter-state", () => {
    const t = computeTotals(items, true);
    expect(t.igstTotal).toBe(round2(5 + 18));
    expect(t.cgstTotal).toBe(0);
  });
});

describe("isInterState", () => {
  it("is true only when both states are known and differ", () => {
    expect(isInterState("27", "29")).toBe(true);
    expect(isInterState("27", "27")).toBe(false);
    expect(isInterState(null, "29")).toBe(false);
    expect(isInterState("27", undefined)).toBe(false);
  });
});

describe("layout helpers", () => {
  it("fit pads and truncates to exact width", () => {
    expect(fit("ab", 4)).toBe("ab  ");
    expect(fit("abcd", 4)).toBe("abcd");
    expect(fit("abcdef", 4)).toBe("abcd");
  });

  it("twoCol right-justifies the right column", () => {
    const line = twoCol("Total", "100.00", 20);
    expect(line).toHaveLength(20);
    expect(line.endsWith("100.00")).toBe(true);
    expect(line.startsWith("Total")).toBe(true);
  });

  it("twoCol truncates when right column overflows", () => {
    expect(twoCol("x", "1234567890", 5)).toBe("12345");
  });

  it("center pads both sides within width", () => {
    expect(center("hi", 6)).toBe("  hi  ");
    expect(center("toolongvalue", 4)).toBe("tool");
  });

  it("divider repeats the char across width", () => {
    expect(divider(5)).toBe("-----");
    expect(divider(3, "=")).toBe("===");
  });

  it("itemRow lays out four columns at full width", () => {
    const rows = itemRow("Paneer Tikka", "2", "250.00", "500.00", 48);
    expect(rows[0]).toContain("Paneer Tikka");
    expect(rows[0]).toContain("500.00");
    expect(rows[0]?.length).toBeLessThanOrEqual(48);
  });

  it("itemRow wraps long names onto continuation lines", () => {
    const longName = "X".repeat(60);
    const rows = itemRow(longName, "1", "10.00", "10.00", 48);
    expect(rows.length).toBeGreaterThan(1);
  });

  it("itemRow falls back to two lines on very narrow paper", () => {
    const rows = itemRow("Item", "1", "10.00", "10.00", 10);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain("x");
  });
});
