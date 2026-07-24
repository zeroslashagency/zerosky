"use client";

import { useCart } from "@/hooks/use-cart";
import { calculateGST } from "@/lib/gst-calculator";
import { useState } from "react";
import { Printer, Download } from "lucide-react";

interface BillPreviewProps {
  orderId?: string;
  orderNumber?: string;
  tableNumber?: string;
}

export function BillPreview({ orderId, orderNumber, tableNumber }: BillPreviewProps) {
  const { items } = useCart();
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"flat" | "percentage">("flat");
  const [managerApproval, setManagerApproval] = useState(false);

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

  const gstCalculation = calculateGST(items, customerState, restaurantInfo.state);
  
  // Calculate service charge (5%)
  const serviceCharge = parseFloat((gstCalculation.subtotal * 0.05).toFixed(2));
  
  // Calculate discount
  let discountAmount = 0;
  if (discountType === "flat") {
    discountAmount = discount;
  } else {
    discountAmount = parseFloat(((gstCalculation.subtotal * discount) / 100).toFixed(2));
  }

  // Grand total
  const grandTotal = parseFloat(
    (gstCalculation.total + serviceCharge - discountAmount).toFixed(2)
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    alert("PDF download will be implemented");
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center border-b-2 pb-4 mb-4">
        <h1 className="text-2xl font-bold">{restaurantInfo.name}</h1>
        <p className="text-sm text-gray-600">{restaurantInfo.address}</p>
        <p className="text-sm text-gray-600">Phone: {restaurantInfo.phone}</p>
        <p className="text-sm font-semibold">GSTIN: {restaurantInfo.gstin}</p>
      </div>

      {/* Bill Info */}
      <div className="flex justify-between mb-4 text-sm">
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
            {new Date().toLocaleDateString("en-IN")}
          </p>
          <p>
            <span className="font-semibold">Time:</span>{" "}
            {new Date().toLocaleTimeString("en-IN")}
          </p>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <table className="w-full text-sm">
          <thead className="border-b-2">
            <tr className="text-left">
              <th className="py-2">Item</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {gstCalculation.breakdown.map((item, index) => (
              <tr key={index} className="border-b">
                <td className="py-2">{item.name}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-right">₹{item.rate.toFixed(2)}</td>
                <td className="text-right">₹{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>₹{gstCalculation.subtotal.toFixed(2)}</span>
        </div>

        {/* GST Breakdown */}
        {gstCalculation.isInterState ? (
          <div className="flex justify-between">
            <span>IGST ({gstCalculation.igst > 0 ? "Integrated" : ""})</span>
            <span>₹{gstCalculation.igst.toFixed(2)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between">
              <span>CGST (Central GST)</span>
              <span>₹{gstCalculation.cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>SGST (State GST)</span>
              <span>₹{gstCalculation.sgst.toFixed(2)}</span>
            </div>
          </>
        )}

        <div className="flex justify-between">
          <span>Service Charge (5%)</span>
          <span>₹{serviceCharge.toFixed(2)}</span>
        </div>

        {/* Discount Section */}
        <div className="border-t pt-2 mt-2">
          <div className="flex gap-2 mb-2">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "flat" | "percentage")}
              className="px-2 py-1 border rounded text-xs"
            >
              <option value="flat">Flat (₹)</option>
              <option value="percentage">Percentage (%)</option>
            </select>
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder="Discount"
              className="flex-1 px-2 py-1 border rounded text-xs"
            />
          </div>
          {discount > 0 && (
            <>
              <div className="flex justify-between text-red-600">
                <span>Discount Applied</span>
                <span>-₹{discountAmount.toFixed(2)}</span>
              </div>
              {((discountType === "percentage" && discount > 10) ||
                (discountType === "flat" && discountAmount > gstCalculation.subtotal * 0.1)) && (
                <label className="flex items-center gap-2 mt-2 text-xs">
                  <input
                    type="checkbox"
                    checked={managerApproval}
                    onChange={(e) => setManagerApproval(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-orange-600">
                    Manager Approval Required ({">"} 10%)
                  </span>
                </label>
              )}
            </>
          )}
        </div>

        {/* Grand Total */}
        <div className="flex justify-between text-xl font-bold border-t-2 pt-2 mt-2">
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
