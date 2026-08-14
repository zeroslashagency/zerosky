"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BillPreview } from "@/components/billing/bill-preview";
import { DiscountControl } from "@/components/cart/discount-control";
import { KOTPreview } from "@/components/kot/kot-preview";
import { PaymentScreen, type PaymentMethod } from "@/components/payment/payment-screen";
import type { CartItem } from "@/hooks/use-cart";
import { CheckCircle, Loader2 } from "lucide-react";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"bill" | "kot" | "payment">("bill");
  const [isProcessing, setIsProcessing] = useState(false);

  const utils = trpc.useUtils();
  const { data: order, isLoading } = trpc.order.get.useQuery({
    id: resolvedParams.id,
  });

  const createPaymentMutation = trpc.payment.record.useMutation({
    onSuccess: async () => {
      setIsProcessing(false);
      // Show success and redirect
      alert("Payment successful!");
      router.push("/dashboard");
    },
    onError: (error) => {
      setIsProcessing(false);
      alert(`Payment failed: ${error.message}`);
    },
  });

  const handlePaymentComplete = async (
    payments: Array<{ method: PaymentMethod; amount: number }>
  ) => {
    if (!order) return;
    setIsProcessing(true);

    try {
      // Create payment records for each method
      for (const payment of payments) {
        await createPaymentMutation.mutateAsync({
          orderId: order.id,
          method: payment.method,
          amount: payment.amount,
          status: "CAPTURED",
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-xl font-semibold text-destructive">Order not found</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Money crosses the tRPC boundary as plain numbers (Number(...) at the API
  // boundary / superjson), so read the persisted figures directly.
  const persistedSubtotal = Number(order.subtotal ?? 0);
  const persistedTax = Number(order.taxTotal ?? 0);
  const persistedDiscount = Number(order.discountTotal ?? 0);
  const orderTotal = Number(order.grandTotal ?? 0);

  const persistedTotals = {
    subtotal: persistedSubtotal,
    taxTotal: persistedTax,
    discountTotal: persistedDiscount,
    discountReason: order.discountReason ?? undefined,
    grandTotal: orderTotal,
  };

  // Effective GST fraction for the live preview only (server stays
  // authoritative). Derived from the persisted tax against the discounted base
  // so the preview matches how the order was actually taxed; falls back to the
  // 5% default when there is nothing to divide.
  const discountedBase = persistedSubtotal - persistedDiscount;
  const effectiveTaxRate =
    discountedBase > 0 ? persistedTax / discountedBase : 0.05;

  const canDiscount =
    order.status !== "PAID" && order.status !== "CANCELLED";

  // Map persisted order lines onto the cart shape the bill/KOT views expect.
  // Without this the bill reads the (already cleared) cart and shows ₹0.00.
  const orderLines: CartItem[] = (order.items ?? []).map((line) => ({
    id: line.id,
    menuItemId: line.itemId,
    name: line.name,
    price: Number(line.unitPrice),
    taxRate: Number(line.taxRate),
    quantity: line.quantity,
    modifiers: [],
    notes: line.notes ?? undefined,
    isVeg: true,
  }));

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-all">Order #{order.orderNumber}</h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-semibold">
              {order.status}
            </span>
            {order.table && (
              <span className="text-muted-foreground">Table: {order.table.name}</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 -mx-4 flex gap-1 sm:gap-2 border-b border-border overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setActiveTab("bill")}
            className={`shrink-0 px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold transition-colors min-h-[44px] ${
              activeTab === "bill" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bill Preview
          </button>
          <button onClick={() => setActiveTab("kot")} className={`shrink-0 px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold transition-colors min-h-[44px] ${activeTab === "kot" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            KOT
          </button>
          <button onClick={() => setActiveTab("payment")} className={`shrink-0 px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold transition-colors min-h-[44px] ${activeTab === "payment" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Payment
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "bill" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <BillPreview
                orderId={order.id}
                orderNumber={order.orderNumber}
                tableNumber={order.table?.name ?? undefined}
                lines={orderLines}
                totals={persistedTotals}
                issuedAt={new Date(order.createdAt)}
              />
            </div>
            <div className="lg:col-span-1">
              <DiscountControl
                orderId={order.id}
                subtotal={persistedSubtotal}
                hasDiscount={persistedDiscount > 0}
                appliedReason={order.discountReason ?? undefined}
                appliedTotal={persistedDiscount}
                effectiveTaxRate={effectiveTaxRate}
                disabled={!canDiscount}
                onChanged={() => utils.order.get.invalidate({ id: order.id })}
              />
            </div>
          </div>
        )}

        {activeTab === "kot" && (
          <KOTPreview
            orderId={order.id}
            orderNumber={order.orderNumber}
            tableNumber={order.table?.name ?? undefined}
            lines={orderLines}
          />
        )}

        {activeTab === "payment" && (
          <>
            {order.status === "PAID" ? (
              <div className="bg-card rounded-lg shadow-lg p-12 text-center">
                <CheckCircle className="w-24 h-24 text-green-600 dark:text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                  Payment Complete!
                </h2>
                <p className="text-muted-foreground mb-6">
                  This order has been paid in full.
                </p>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            ) : (
              <>
                {isProcessing ? (
                  <div className="bg-card rounded-lg shadow-lg p-12 text-center">
                    <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-lg font-semibold text-card-foreground">Processing payment...</p>
                  </div>
                ) : (
                  <PaymentScreen
                    totalAmount={orderTotal}
                    onPaymentComplete={handlePaymentComplete}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
