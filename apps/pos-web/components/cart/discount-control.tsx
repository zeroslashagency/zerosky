"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Loader2, Percent, IndianRupee, Tag, X } from "lucide-react";

interface DiscountControlProps {
  orderId: string;
  /** Pre-discount taxable base (persisted order.subtotal), in rupees. */
  subtotal: number;
  /** Whether a discount is already applied, for the remove affordance. */
  hasDiscount: boolean;
  appliedReason?: string | null;
  appliedTotal?: number;
  /** GST applied across the order, as a fraction (e.g. 0.05 for 5%). Used only
   *  for the client-side live PREVIEW; the server remains authoritative. */
  effectiveTaxRate: number;
  /** Read-only when the order can no longer be discounted (PAID/CANCELLED). */
  disabled?: boolean;
  onChanged: () => void;
}

/**
 * Order-level discount control. It shows a live preview of the new grand total
 * BEFORE the operator confirms, but the preview is advisory only — the applied
 * numbers always come back from the server (order.applyDiscount), which is the
 * single source of truth for the bill and the charge.
 */
export function DiscountControl({
  orderId,
  subtotal,
  hasDiscount,
  appliedReason,
  appliedTotal,
  effectiveTaxRate,
  disabled,
  onChanged,
}: DiscountControlProps) {
  const [type, setType] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const applyMutation = trpc.order.applyDiscount.useMutation({
    onSuccess: () => {
      setError(null);
      setValue("");
      setReason("");
      onChanged();
    },
    onError: (e) => setError(e.message),
  });

  const removeMutation = trpc.order.removeDiscount.useMutation({
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (e) => setError(e.message),
  });

  const numeric = parseFloat(value) || 0;

  // Client-side validation mirrors the server so the operator sees the problem
  // inline before a round-trip. The server re-validates regardless.
  let validationError: string | null = null;
  if (numeric < 0) {
    validationError = "Discount cannot be negative.";
  } else if (type === "PERCENT" && numeric > 100) {
    validationError = "A percentage discount cannot exceed 100%.";
  }

  const previewDiscount =
    type === "PERCENT"
      ? parseFloat(((subtotal * numeric) / 100).toFixed(2))
      : parseFloat(numeric.toFixed(2));

  if (type === "FLAT" && previewDiscount > subtotal) {
    validationError = `Discount ₹${previewDiscount.toFixed(2)} exceeds the subtotal ₹${subtotal.toFixed(2)}.`;
  }

  // Preview: GST recomputed on the discounted base (discount before tax).
  const previewTaxable = Math.max(0, subtotal - previewDiscount);
  const previewTax = parseFloat((previewTaxable * effectiveTaxRate).toFixed(2));
  const previewGrand = parseFloat((previewTaxable + previewTax).toFixed(2));

  const canApply =
    !disabled &&
    numeric > 0 &&
    reason.trim().length > 0 &&
    !validationError &&
    !applyMutation.isPending;

  const handleApply = () => {
    if (!canApply) return;
    setError(null);
    applyMutation.mutate({ orderId, type, value: numeric, reason: reason.trim() });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-card-foreground">
        <Tag className="w-4 h-4" />
        <h3 className="font-semibold">Discount</h3>
      </div>

      {hasDiscount && (
        <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
          <div className="text-sm text-muted-foreground">
            Applied: <span className="text-card-foreground font-medium">-₹{(appliedTotal ?? 0).toFixed(2)}</span>
            {appliedReason ? ` — ${appliedReason}` : ""}
          </div>
          <button
            onClick={() => removeMutation.mutate({ orderId })}
            disabled={disabled || removeMutation.isPending}
            className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
          >
            {removeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            Remove
          </button>
        </div>
      )}

      {!disabled && (
        <>
          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("PERCENT")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md border text-sm transition-colors ${
                type === "PERCENT"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-input hover:bg-muted"
              }`}
            >
              <Percent className="w-4 h-4" /> Percent
            </button>
            <button
              type="button"
              onClick={() => setType("FLAT")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md border text-sm transition-colors ${
                type === "FLAT"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-input hover:bg-muted"
              }`}
            >
              <IndianRupee className="w-4 h-4" /> Flat
            </button>
          </div>

          {/* Value */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {type === "PERCENT" ? "Percentage (%)" : "Amount (₹)"}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "PERCENT" ? "10" : "50"}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          {/* Reason (required) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Reason (required)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Loyalty regular, manager comp"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          {/* Live preview (advisory) */}
          {numeric > 0 && !validationError && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600 dark:text-red-400">
                <span>Discount</span>
                <span>-₹{previewDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (on discounted base)</span>
                <span>₹{previewTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-card-foreground border-t border-border pt-1">
                <span>New Total</span>
                <span>₹{previewGrand.toFixed(2)}</span>
              </div>
            </div>
          )}

          {(validationError || error) && (
            <p className="text-sm text-destructive">{validationError ?? error}</p>
          )}

          <button
            onClick={handleApply}
            disabled={!canApply}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {hasDiscount ? "Update Discount" : "Apply Discount"}
          </button>
        </>
      )}
    </div>
  );
}
