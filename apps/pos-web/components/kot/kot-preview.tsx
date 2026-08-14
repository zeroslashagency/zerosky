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
    document.body.classList.add('print-kot-only');
    const done = () => { document.body.classList.remove('print-kot-only'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  };

  return (
    // KOT must stay high-contrast on dark mode + print — fixed light paper, not theme tokens.
    <div id="zerosky-kot-paper" className="rounded-lg shadow-lg p-6 max-w-2xl mx-auto" style={{ background: '#fff', color: '#111827' }}>
      <div className="text-center pb-4 mb-4" style={{ borderBottom: '2px dashed #d1d5db' }}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <ChefHat className="w-8 h-8" style={{ color: '#111827' }} />
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>KITCHEN ORDER TICKET</h1>
        </div>
        {isPriority && (
          <div className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-lg">
            ⚠️ PRIORITY ORDER ⚠️
          </div>
        )}
      </div>

      <div className="mb-4 text-sm space-y-1" style={{ color: '#111827' }}>
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
        <div className="px-3 py-2 font-bold text-sm" style={{ background: '#f3f4f6', color: '#111827', borderBottom: '2px solid #d1d5db' }}>ITEMS</div>
        <div className="space-y-3 py-2">
          {items.map((item, index) => (
            <div key={index} className="pb-3" style={{ borderBottom: '1px dashed #d1d5db' }}>
              <div className="flex justify-between items-start mb-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold" style={{ color: '#111827' }}>{item.quantity}x</span>
                    <span className="text-lg font-semibold" style={{ color: '#111827' }}>{item.name}</span>
                    {item.isVeg ? (
                      <span className="text-green-600 text-xs">🟢 VEG</span>
                    ) : (
                      <span className="text-red-600 text-xs">🔴 NON-VEG</span>
                    )}
                  </div>

                  {item.modifiers.length > 0 && <div className="ml-12 mt-1">{item.modifiers.map((m) => m.options.map((o) => <div key={o.id} className="text-sm font-medium" style={{ color: '#374151' }}>• {o.name}</div>))}</div>}

                  {item.notes && <div className="ml-12 mt-2 p-2" style={{ background: '#fef3c7', borderLeft: '4px solid #eab308' }}><p className="text-sm font-semibold" style={{ color: '#92400e' }}>📝 SPECIAL NOTE: {item.notes}</p></div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div data-print="hide" className="mb-4">
        <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ border: '2px solid #d1d5db' }}>
          <input type="checkbox" checked={isPriority} onChange={(e) => setIsPriority(e.target.checked)} className="w-5 h-5" style={{ accentColor: '#dc2626' }} />
          <span className="font-semibold" style={{ color: '#dc2626' }}>Mark as Priority Order</span>
        </label>
      </div>
      <div data-print="hide" className="flex gap-3">
        <button onClick={handleGenerateKOT} disabled={isGenerating} className="flex-1 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold disabled:opacity-50" style={{ background: '#16a34a', color: '#fff' }}>{isGenerating ? "Generating..." : "Generate KOT"}</button>
        <button onClick={handlePrint} className="flex-1 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold" style={{ background: '#2563eb', color: '#fff' }}><Printer className="w-5 h-5" /> Print KOT</button>
      </div>
      <div className="text-center mt-6 pt-4 text-xs" style={{ color: '#6b7280', borderTop: '1px dashed #d1d5db' }}><p>*** END OF KOT ***</p></div>
    </div>
  );
}
