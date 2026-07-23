import type { CartItem } from "@/hooks/use-cart";

export interface ItemBreakdown {
  name: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalWithTax: number;
}

export interface GSTCalculation {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
  breakdown: ItemBreakdown[];
  isInterState: boolean;
}

/**
 * Calculate GST for cart items
 * @param items Cart items
 * @param customerState Customer's state code (e.g., "MH", "DL")
 * @param restaurantState Restaurant's state code
 * @returns GST calculation with breakdown
 */
export function calculateGST(
  items: CartItem[],
  customerState: string,
  restaurantState: string
): GSTCalculation {
  const isInterState = customerState !== restaurantState;
  let subtotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  const breakdown: ItemBreakdown[] = [];

  items.forEach((item) => {
    // Calculate base item price with modifiers
    let itemPrice = item.price;
    item.modifiers.forEach((modifier) => {
      modifier.options.forEach((option) => {
        itemPrice += option.price;
      });
    });

    const amount = itemPrice * item.quantity;
    subtotal += amount;

    // Calculate GST based on item's tax rate
    const taxRate = item.taxRate;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterState) {
      // Inter-state: IGST (full rate)
      igst = (amount * taxRate) / 100;
      totalIGST += igst;
    } else {
      // Intra-state: CGST + SGST (split equally)
      cgst = (amount * taxRate) / 200; // Half of total rate
      sgst = (amount * taxRate) / 200; // Half of total rate
      totalCGST += cgst;
      totalSGST += sgst;
    }

    breakdown.push({
      name: item.name,
      quantity: item.quantity,
      rate: itemPrice,
      amount: parseFloat(amount.toFixed(2)),
      taxRate,
      cgst: parseFloat(cgst.toFixed(2)),
      sgst: parseFloat(sgst.toFixed(2)),
      igst: parseFloat(igst.toFixed(2)),
      totalWithTax: parseFloat((amount + cgst + sgst + igst).toFixed(2)),
    });
  });

  const totalTax = totalCGST + totalSGST + totalIGST;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    cgst: parseFloat(totalCGST.toFixed(2)),
    sgst: parseFloat(totalSGST.toFixed(2)),
    igst: parseFloat(totalIGST.toFixed(2)),
    totalTax: parseFloat(totalTax.toFixed(2)),
    total: parseFloat((subtotal + totalTax).toFixed(2)),
    breakdown,
    isInterState,
  };
}

/**
 * Format GST number for display
 */
export function formatGSTIN(gstin: string): string {
  if (!gstin || gstin.length !== 15) return gstin;
  // Format: 12ABC3456D1Z5
  return `${gstin.slice(0, 2)}-${gstin.slice(2, 7)}-${gstin.slice(7, 12)}-${gstin.slice(12)}`;
}

/**
 * Validate GSTIN format
 */
export function validateGSTIN(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}
