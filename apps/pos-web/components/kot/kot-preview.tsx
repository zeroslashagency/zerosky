"use client";

import { useCart, type CartItem } from "@/hooks/use-cart";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Printer, ChefHat } from "lucide-react";

interface KOTPreviewProps {
  orderId: string;
  orderNumber?: string;
  tableNumber?: string;
  /**
   * Lines of an already-persisted order. The cart is cleared once an order is
   * saved, so a KOT rendered from the cart alone would list no items.
   */
  lines?: CartItem[];
}

export function KOTPreview({ orderId, orderNumber, tableNumber, lines }: KOTPreviewProps) {
  const { items: cartItems } = useCart();
  const items = lines ?? cartItems;
  const [isPriority, setIsPriority] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const createKOTMutation = trpc.kot.generate.useMutation({
    onSuccess: () => {
      setIsGenerating(false);
      alert("KOT generated successfully!");
    },
    onError: (error) => {
      setIsGenerating(false);
      alert(`Error generating KOT: ${error.message}`);
    },
  });

  const handleGenerateKOT = async () => {
    setIsGenerating(true);

    try {
      await createKOTMutation.mutateAsync({
        orderId,
        station: "MAIN_KITCHEN",
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    // KOT must stay light for thermal printing - do NOT theme this component
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ChefHat className="w-8 h-8 text-gray-900" />
          <h1 className="text-2xl font-bold text-gray-900">KITCHEN ORDER TICKET</h1>
        </div>
        {isPriority && (
          <div className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-lg">
            ⚠️ PRIORITY ORDER ⚠️
          </div>
        )}
      </div>

      {/* Order Info */}
      <div className="mb-4 text-sm space-y-1 text-gray-900">
        <div className="flex justify-between">
          <span className="font-semibold">Order #:</span>
          <span className="text-xl font-bold">{orderNumber || "ORD-001"}</span>
        </div>
        {tableNumber && (
          <div className="flex justify-between">
            <span className="font-semibold">Table:</span>
            <span className="text-xl font-bold">{tableNumber}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="font-semibold">Time:</span>
          <span>{new Date().toLocaleTimeString("en-IN")}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold">Date:</span>
          <span>{new Date().toLocaleDateString("en-IN")}</span>
        </div>
      </div>

      {/* Items */}
      <div className="mb-6">
        <div className="bg-gray-100 px-3 py-2 font-bold text-sm border-b-2 border-gray-300 text-gray-900">
          ITEMS
        </div>
        <div className="space-y-3 py-2">
          {items.map((item, index) => (
            <div key={index} className="border-b border-dashed border-gray-300 pb-3">
              <div className="flex justify-between items-start mb-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{item.quantity}x</span>
                    <span className="text-lg font-semibold text-gray-900">{item.name}</span>
                    {item.isVeg ? (
                      <span className="text-green-600 text-xs">🟢 VEG</span>
                    ) : (
                      <span className="text-red-600 text-xs">🔴 NON-VEG</span>
                    )}
                  </div>

                  {/* Modifiers */}
                  {item.modifiers.length > 0 && (
                    <div className="ml-12 mt-1">
                      {item.modifiers.map((modifier) =>
                        modifier.options.map((option) => (
                          <div
                            key={option.id}
                            className="text-sm text-gray-700 font-medium"
                          >
                            • {option.name}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {item.notes && (
                    <div className="ml-12 mt-2 bg-yellow-100 border-l-4 border-yellow-500 p-2">
                      <p className="text-sm font-semibold text-yellow-800">
                        📝 SPECIAL NOTE: {item.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Checkbox */}
      <div className="mb-4">
        <label className="flex items-center gap-3 p-3 border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={isPriority}
            onChange={(e) => setIsPriority(e.target.checked)}
            className="w-5 h-5 text-red-600"
          />
          <span className="font-semibold text-red-600">Mark as Priority Order</span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleGenerateKOT}
          disabled={isGenerating}
          className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold disabled:opacity-50"
        >
          {isGenerating ? "Generating..." : "Generate KOT"}
        </button>
        <button
          onClick={handlePrint}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold"
        >
          <Printer className="w-5 h-5" />
          Print KOT
        </button>
      </div>

      {/* Footer */}
      <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-300 text-xs text-gray-500">
        <p>*** END OF KOT ***</p>
      </div>
    </div>
  );
}
