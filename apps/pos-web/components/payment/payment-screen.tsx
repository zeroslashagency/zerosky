"use client";

import { useState } from "react";
import { CreditCard, Banknote, Smartphone, Split } from "lucide-react";

export type PaymentMethod = "CASH" | "CARD" | "UPI";

interface PaymentScreenProps {
  totalAmount: number;
  onPaymentComplete: (payments: Array<{ method: PaymentMethod; amount: number }>) => void;
}

export function PaymentScreen({ totalAmount, onPaymentComplete }: PaymentScreenProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: PaymentMethod; amount: number }>>([]);
  const [cashReceived, setCashReceived] = useState<number>(0);

  const remainingAmount = isSplitPayment
    ? totalAmount - splitPayments.reduce((sum, p) => sum + p.amount, 0)
    : totalAmount;

  const handleAddSplitPayment = (method: PaymentMethod, amount: number) => {
    if (amount <= 0 || amount > remainingAmount) return;
    setSplitPayments([...splitPayments, { method, amount }]);
    setSelectedMethod(null);
  };

  const handleRemoveSplitPayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };

  const handleCompleteSinglePayment = () => {
    if (!selectedMethod) return;
    onPaymentComplete([{ method: selectedMethod, amount: totalAmount }]);
  };

  const handleCompleteSplitPayment = () => {
    if (Math.abs(remainingAmount) > 0.01) return;
    onPaymentComplete(splitPayments);
  };

  const paymentMethods = [
    {
      method: "CASH" as PaymentMethod,
      label: "Cash",
      icon: Banknote,
      color: "bg-green-600 hover:bg-green-700",
    },
    {
      method: "CARD" as PaymentMethod,
      label: "Card",
      icon: CreditCard,
      color: "bg-blue-600 hover:bg-blue-700",
    },
    {
      method: "UPI" as PaymentMethod,
      label: "UPI",
      icon: Smartphone,
      color: "bg-purple-600 hover:bg-purple-700",
    },
  ];

  return (
    <div className="bg-card rounded-lg shadow-lg p-6 max-w-2xl mx-auto border border-border">
      <h2 className="text-2xl font-bold mb-6 text-card-foreground">Payment</h2>

      {/* Total Amount */}
      <div className="bg-muted rounded-lg p-4 mb-6">
        <p className="text-sm text-muted-foreground">Total Amount</p>
        <p className="text-4xl font-bold text-foreground">₹{totalAmount.toFixed(2)}</p>
        {isSplitPayment && remainingAmount > 0 && (
          <p className="text-lg text-orange-600 dark:text-orange-400 mt-2">
            Remaining: ₹{remainingAmount.toFixed(2)}
          </p>
        )}
      </div>

      {/* Split Payment Toggle */}
      <div className="mb-6">
        <label className="flex items-center gap-3 p-3 border-2 border-input rounded-lg cursor-pointer hover:bg-muted">
          <input
            type="checkbox"
            checked={isSplitPayment}
            onChange={(e) => {
              setIsSplitPayment(e.target.checked);
              setSplitPayments([]);
              setSelectedMethod(null);
            }}
            className="w-5 h-5"
          />
          <Split className="w-5 h-5" />
          <span className="font-semibold text-foreground">Split Payment</span>
        </label>
      </div>

      {/* Split Payments List */}
      {isSplitPayment && splitPayments.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Payment Breakdown:</p>
          {splitPayments.map((payment, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-muted p-3 rounded border border-border"
            >
              <span className="font-medium text-foreground">
                {payment.method}: ₹{payment.amount.toFixed(2)}
              </span>
              <button
                onClick={() => handleRemoveSplitPayment(index)}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Payment Method Selection */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-muted-foreground mb-3">
          {isSplitPayment ? "Add Payment Method:" : "Select Payment Method:"}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {paymentMethods.map(({ method, label, icon: Icon, color }) => (
            <button
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={`p-4 rounded-lg text-white transition-colors flex flex-col items-center gap-2 ${
                selectedMethod === method
                  ? color
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="w-8 h-8" />
              <span className="font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cash Payment Details */}
      {selectedMethod === "CASH" && !isSplitPayment && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <label className="block text-sm font-semibold text-muted-foreground mb-2">
            Cash Received
          </label>
          <input
            type="number"
            value={cashReceived || ""}
            onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
            placeholder="Enter amount"
            className="w-full px-4 py-2 border border-input rounded-lg text-xl font-semibold bg-background text-foreground"
            step="0.01"
            min={totalAmount}
          />
          {cashReceived >= totalAmount && (
            <div className="mt-3 text-green-700 dark:text-green-300">
              <p className="text-sm">Change to return:</p>
              <p className="text-2xl font-bold">
                ₹{(cashReceived - totalAmount).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Split Payment Amount Input */}
      {isSplitPayment && selectedMethod && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <label className="block text-sm font-semibold text-muted-foreground mb-2">
            Amount for {selectedMethod}
          </label>
          <input
            type="number"
            placeholder="Enter amount"
            className="w-full px-4 py-2 border border-input rounded-lg text-xl font-semibold mb-3 bg-background text-foreground"
            step="0.01"
            max={remainingAmount}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const amount = parseFloat((e.target as HTMLInputElement).value);
                if (amount > 0 && amount <= remainingAmount) {
                  handleAddSplitPayment(selectedMethod, amount);
                  (e.target as HTMLInputElement).value = "";
                }
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              const amount = parseFloat(input.value);
              if (amount > 0 && amount <= remainingAmount) {
                handleAddSplitPayment(selectedMethod, amount);
                input.value = "";
              }
            }}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Add Payment
          </button>
        </div>
      )}

      {/* Complete Payment Button */}
      {!isSplitPayment && selectedMethod && (
        <button
          onClick={handleCompleteSinglePayment}
          disabled={selectedMethod === "CASH" && cashReceived < totalAmount}
          className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Complete Payment
        </button>
      )}

      {isSplitPayment && (
        <button
          onClick={handleCompleteSplitPayment}
          disabled={Math.abs(remainingAmount) > 0.01}
          className="w-full bg-green-600 text-white py-4 rounded-lg hover:bg-green-700 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {Math.abs(remainingAmount) > 0.01
            ? `Remaining: ₹${remainingAmount.toFixed(2)}`
            : "Complete Split Payment"}
        </button>
      )}
    </div>
  );
}
