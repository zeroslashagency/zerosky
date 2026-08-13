"use client";

import { useCart, type CartItem } from "@/hooks/use-cart";
import { calculateGST } from "@/lib/gst-calculator";
import { Printer, Download } from "lucide-react";

/**
 * Server-authoritative totals for a persisted order. When supplied, the bill
 * renders exactly what the API stored — subtotal, discount, GST and grand total
 * — and does NOT recompute anything client-side. A client-only figure (an
 * ad-hoc service charge, a locally computed discount) once made the printed
 * bill disagree with the amount the payment screen actually charged; the fix is
 * to trust the persisted order and nothing else.
 */
export interface PersistedTotals {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  discountReason?: string | null;
  grandTotal: number;
  /** Inter-state orders use a single IGST line instead of CGST/SGST. */
  isInterState?: boolean;
}

interface BillPreviewProps {
  orderId?: string;
  orderNumber?: string;
  tableNumber?: string;
  /**
   * Lines of an already-persisted order. Creating an order clears the cart, so
   * a saved order billed from the cart always rendered ₹0.00. When this is
   * supplied the bill is calculated from the stored lines instead.
   */
  lines?: CartItem[];
  /**
   * Persisted totals from the saved order. When present the bill is rendered
   * from these values verbatim; the client never recomputes GST or discount.
   */
  totals?: PersistedTotals;
  /** Timestamp the order was created; falls back to now for an unsaved cart. */
  issuedAt?: Date;
}

export function BillPreview({
  orderId,
  orderNumber,
  tableNumber,
  lines,
  totals,
  issuedAt,
}: BillPreviewProps) {
  const { items: cartItems } = useCart();
  const items = lines ?? cartItems;
  const billedAt = issuedAt ?? new Date();

  // Mock restaurant info - in production this comes from database
  const restaurantInfo = {
    name: "Zerosky Restaurant",
    address: "123 Main Street, Mumbai, Maharashtra 400001",
    gstin: "27AABCU9603R1ZM",
    phone: "+91 98765 43210",
    state: "MH",
  };

  // Mock customer state - in production this comes from order
  const customerState = "MH";

  // Line breakdown for the item table (display only). Totals below come from
  // the server when a persisted order is supplied.
  const gstCalculation = calculateGST(items, customerState, restaurantInfo.state);

  // When persisted totals are present they are authoritative. Otherwise (an
  // unsaved cart preview) fall back to the client GST calc with no discount.
  const subtotal = totals ? totals.subtotal : gstCalculation.subtotal;
  const discountAmount = totals ? totals.discountTotal : 0;
  const discountReason = totals?.discountReason ?? undefined;
  const isInterState = totals?.isInterState ?? gstCalculation.isInterState;
  const taxTotal = totals ? totals.taxTotal : gstCalculation.totalTax;
  // GST is stored as a single tax figure on the order; the bill splits it into
  // the CGST/SGST halves an Indian invoice must show (or a single IGST line for
  // inter-state supply).
  const cgst = isInterState ? 0 : parseFloat((taxTotal / 2).toFixed(2));
  const sgst = isInterState ? 0 : parseFloat((taxTotal - cgst).toFixed(2));
  const igst = isInterState ? taxTotal : 0;
  const grandTotal = totals
    ? totals.grandTotal
    : parseFloat((gstCalculation.total).toFixed(2));

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    alert("PDF download will be implemented");
  };

  return (
    // Bill must stay light for thermal/paper printing - do NOT theme this component
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-900 pb-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{restaurantInfo.name}</h1>
        <p className="text-sm text-gray-600">{restaurantInfo.address}</p>
        <p className="text-sm text-gray-600">Phone: {restaurantInfo.phone}</p>
        <p className="text-sm font-semibold text-gray-900">GSTIN: {restaurantInfo.gstin}</p>
      </div>

      {/* Bill Info */}
      <div className="flex justify-between mb-4 text-sm text-gray-900">
        <div>
          <p>
            <span className="font-semibold">Bill No:</span>{" "}
            {orderNumber || "BILL-001"}
          </p>
          {tableNumber && (
            <p>
              <span className="font-semibold">Table:</span> {tableNumber}
            </p>
          )}
        </div>
        <div className="text-right">
          <p>
            <span className="font-semibold">Date:</span>{" "}
            {billedAt.toLocaleDateString("en-IN")}
          </p>
          <p>
            <span className="font-semibold">Time:</span>{" "}
            {billedAt.toLocaleTimeString("en-IN")}
          </p>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <table className="w-full text-sm text-gray-900">
          <thead className="border-b-2 border-gray-900">
            <tr className="text-left">
              <th className="py-2">Item</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {gstCalculation.breakdown.map((item, index) => (
              <tr key={index} className="border-b border-gray-300">
                <td className="py-2">{item.name}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">₹{item.rate.toFixed(2)}</td>
                <td className="text-right">₹{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals — rendered from the PERSISTED order when available so the
          printed bill can never disagree with the amount charged. */}
      <div className="space-y-2 text-sm text-gray-900">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>

        {/* Discount is applied to the taxable base BEFORE GST, so it sits above
            the tax lines. Shown negative, with the reason the operator gave. */}
        {discountAmount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>
              Discount{discountReason ? ` (${discountReason})` : ""}
            </span>
            <span>-₹{discountAmount.toFixed(2)}</span>
          </div>
        )}

        {/* GST Breakdown — computed on the discounted base by the server. */}
        {isInterState ? (
          <div className="flex justify-between">
            <span>IGST (Integrated)</span>
            <span>₹{igst.toFixed(2)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between">
              <span>CGST (Central GST)</span>
              <span>₹{cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>SGST (State GST)</span>
              <span>₹{sgst.toFixed(2)}</span>
            </div>
          </>
        )}

        {/* Grand Total */}
        <div className="flex justify-between text-xl font-bold border-t-2 border-gray-900 pt-2 mt-2 text-gray-900">
          <span>Grand Total</span>
          <span>₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={handlePrint}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Printer className="w-5 h-5" />
          Print Bill
        </button>
        <button
          onClick={handleDownloadPDF}
          className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download PDF
        </button>
      </div>

      {/* Footer */}
      <div className="text-center mt-6 pt-4 border-t text-xs text-gray-500">
        <p>Thank you for dining with us!</p>
        <p>This is a computer-generated bill</p>
      </div>
    </div>
  );
}
