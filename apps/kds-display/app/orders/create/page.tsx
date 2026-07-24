"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function CreateOrderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, clearCart, calculateTotals } = useCart();
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = calculateTotals();

  // Fetch tables - using a mock branchId for now
  // In production, this should come from the user's context or selected branch
  const { data: tables, isLoading: tablesLoading } = trpc.table.list.useQuery({
    branchId: "default-branch", // TODO: Get from user context
  });

  const createOrderMutation = trpc.order.create.useMutation({
    onSuccess: (order) => {
      clearCart();
      setIsCreating(false);
      router.push(`/orders/${order.id}`);
    },
    onError: (error) => {
      setError(error.message);
      setIsCreating(false);
    },
  });

  const handleCreateOrder = async () => {
    if (items.length === 0) {
      setError("Cart is empty");
      return;
    }

    if (!user) {
      setError("User not authenticated");
      return;
    }

    setIsCreating(true);
    setError(null);

    // Convert cart items to order line items
    const orderItems = items.map((item) => ({
      itemId: item.menuItemId,
      quantity: item.quantity,
      notes: item.notes,
    }));

    try {
      await createOrderMutation.mutateAsync({
        branchId: "default-branch", // TODO: Get from user context
        tableId: selectedTableId || undefined,
        type: "DINE_IN",
        guestCount: 1,
        items: orderItems,
      });
    } catch (err) {
      // Error handled in mutation callbacks
      console.error(err);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Cart is Empty</h1>
          <p className="text-gray-600 mb-6">
            Add items to your cart before creating an order
          </p>
          <button
            onClick={() => router.push("/menu")}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create Order</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Order Details */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Order Details</h2>

            {/* Table Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Table (Optional)
              </label>
              {tablesLoading ? (
                <div className="text-gray-500">Loading tables...</div>
              ) : (
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Table (Takeaway)</option>
                  {tables?.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name} - {table.seats} seats
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Create Order Button */}
            <button
              onClick={handleCreateOrder}
              disabled={isCreating}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Order...
                </>
              ) : (
                "Create Order"
              )}
            </button>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

            {/* Items List */}
            <div className="space-y-3 mb-6">
              {items.map((item) => {
                const modifierPrice = item.modifiers.reduce(
                  (sum, mod) =>
                    sum + mod.options.reduce((s, opt) => s + opt.price, 0),
                  0
                );
                const itemTotal = (item.price + modifierPrice) * item.quantity;

                return (
                  <div
                    key={item.id}
                    className="flex justify-between items-start pb-3 border-b"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        Qty: {item.quantity} × ₹
                        {(item.price + modifierPrice).toFixed(2)}
                      </p>
                      {item.modifiers.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {item.modifiers.map((mod) =>
                            mod.options.map((opt) => (
                              <span
                                key={opt.id}
                                className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1"
                              >
                                {opt.name}
                              </span>
                            ))
                          )}
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-500 italic mt-1">
                          Note: {item.notes}
                        </p>
                      )}
                    </div>
                    <p className="font-semibold">₹{itemTotal.toFixed(2)}</p>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax (GST)</span>
                <span>₹{totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>Total</span>
                <span>₹{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
