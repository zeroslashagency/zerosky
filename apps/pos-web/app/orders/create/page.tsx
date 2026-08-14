"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";
import { useBranch } from "@/hooks/use-branch";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

export default function CreateOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { items, clearCart, calculateTotals } = useCart();
  // The floor plan links here as /orders/create?tableId=…, so preselect that
  // table instead of silently dropping it and defaulting to takeaway.
  const [selectedTableId, setSelectedTableId] = useState<string>(
    searchParams.get("tableId") ?? "",
  );
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = calculateTotals();

  // The branch comes from the session's tenant, not a hardcoded id. A literal
  // "default-branch" made table.list 404 and left the selector stuck loading.
  const {
    branchId,
    branchName,
    isLoading: branchLoading,
    error: branchError,
  } = useBranch();

  const { data: tables, isLoading: tablesLoading } = trpc.table.list.useQuery(
    { branchId: branchId ?? "" },
    { enabled: Boolean(branchId) },
  );

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

    if (!branchId) {
      setError("No branch available for this account.");
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
        branchId,
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
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-foreground">Cart is Empty</h1>
          <p className="text-muted-foreground mb-6">
            Add items to your cart before creating an order
          </p>
          <button
            onClick={() => router.push("/menu")}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go to Menu
          </button>
        </div>
      </div>
    );
  }

  if (branchLoading) {
    return <div className="p-6 text-muted-foreground">Loading branch…</div>;
  }

  if (branchError || !branchId) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{branchError ?? "No branch available for this tenant."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 text-foreground">Create Order</h1>
        <p className="mb-6 text-sm text-muted-foreground">{branchName ?? "Branch"}</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Order Details */}
          <div className="bg-card rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Order Details</h2>

            {/* Table Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-card-foreground mb-2">
                Select Table (Optional)
              </label>
              {tablesLoading ? (
                <div className="text-muted-foreground">Loading tables...</div>
              ) : (
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
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
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            {/* Create Order Button */}
            <button
              onClick={handleCreateOrder}
              disabled={isCreating}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="bg-card rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">Order Summary</h2>

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
                    className="flex justify-between items-start pb-3 border-b border-border"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-card-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × ₹
                        {(item.price + modifierPrice).toFixed(2)}
                      </p>
                      {item.modifiers.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.modifiers.map((mod) =>
                            mod.options.map((opt) => (
                              <span
                                key={opt.id}
                                className="inline-block bg-muted px-2 py-0.5 rounded mr-1"
                              >
                                {opt.name}
                              </span>
                            ))
                          )}
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                          Note: {item.notes}
                        </p>
                      )}
                    </div>
                    <p className="font-semibold text-card-foreground">₹{itemTotal.toFixed(2)}</p>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax (GST)</span>
                <span>₹{totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t border-border text-card-foreground">
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
