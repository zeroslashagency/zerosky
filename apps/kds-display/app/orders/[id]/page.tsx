"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BillPreview } from "@/components/billing/bill-preview";
import { KOTPreview } from "@/components/kot/kot-preview";
import { PaymentScreen, type PaymentMethod } from "@/components/payment/payment-screen";
import { CheckCircle, Loader2 } from "lucide-react";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"bill" | "kot" | "payment">("bill");
  const [isProcessing, setIsProcessing] = useState(false);

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
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-xl font-semibold text-red-600">Order not found</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const orderTotal = parseFloat(order.grandTotal?.toString() || "0");

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Order #{order.orderNumber}</h1>
          <div className="flex items-center gap-4 mt-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
              {order.status}
            </span>
            {order.tableId && (
              <span className="text-gray-600">Table: {order.tableId}</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b">
          <button
            onClick={() => setActiveTab("bill")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "bill"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Bill Preview
          </button>
          <button
            onClick={() => setActiveTab("kot")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "kot"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            KOT
          </button>
          <button
            onClick={() => setActiveTab("payment")}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "payment"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Payment
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "bill" && (
          <BillPreview
            orderId={order.id}
            orderNumber={order.orderNumber}
            tableNumber={order.tableId || undefined}
          />
        )}

        {activeTab === "kot" && (
          <KOTPreview
            orderId={order.id}
            orderNumber={order.orderNumber}
            tableNumber={order.tableId || undefined}
          />
        )}

        {activeTab === "payment" && (
          <>
            {order.status === "PAID" ? (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <CheckCircle className="w-24 h-24 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-600 mb-2">
                  Payment Complete!
                </h2>
                <p className="text-gray-600 mb-6">
                  This order has been paid in full.
                </p>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            ) : (
              <>
                {isProcessing ? (
                  <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                    <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-lg font-semibold">Processing payment...</p>
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
