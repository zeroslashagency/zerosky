// @zerosky/payments — refund handling
// Only CAPTURED payments can be refunded. Full or partial refunds are issued
// via the gateway; on success the local payment transitions to REFUNDED.

import { RazorpayGateway } from "./razorpay.js";
import { toPaise } from "./money.js";
import type { PaymentRepository, PaymentRecord } from "./repository.js";
import { canTransition, InvalidTransitionError } from "./state.js";
import type { RazorpayRefundResult } from "./types.js";

/** Thrown when a refund amount is invalid relative to the captured amount. */
export class RefundAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundAmountError";
  }
}

/** Input for refunding a captured payment. */
export interface RefundPaymentInput {
  /** Local payment id (from the repository). */
  localPaymentId: string;
  /** Gateway payment id to refund against. */
  razorpayPaymentId: string;
  /**
   * Amount to refund in rupees. Omit for a full refund of the captured amount.
   * Must be > 0 and ≤ the captured amount for partial refunds.
   */
  amountRupees?: number;
  notes?: Record<string, string>;
}

/** Result of a refund: the gateway refund entity + updated payment record. */
export interface RefundPaymentResult {
  refund: RazorpayRefundResult;
  payment: PaymentRecord;
}

/**
 * Refund a captured payment. Validates state (must be CAPTURED) and amount,
 * issues the refund via the gateway, then marks the payment REFUNDED.
 */
export async function refundPayment(
  gateway: RazorpayGateway,
  repository: PaymentRepository,
  input: RefundPaymentInput,
): Promise<RefundPaymentResult> {
  const existing = await repository.findById(input.localPaymentId);
  if (!existing) {
    throw new Error(`Payment not found: ${input.localPaymentId}`);
  }

  if (!canTransition(existing.status, "REFUNDED")) {
    throw new InvalidTransitionError(existing.status, "REFUNDED");
  }

  if (input.amountRupees !== undefined) {
    if (toPaise(input.amountRupees) <= 0) {
      throw new RefundAmountError(
        `Refund amount must be positive, got ₹${input.amountRupees}`,
      );
    }
    if (toPaise(input.amountRupees) > toPaise(existing.amount)) {
      throw new RefundAmountError(
        `Refund amount ₹${input.amountRupees} exceeds captured amount ₹${existing.amount}`,
      );
    }
  }

  const refund = await gateway.createRefund(
    input.razorpayPaymentId,
    input.amountRupees,
    input.notes,
  );

  const payment = await repository.updateStatus(
    input.localPaymentId,
    "REFUNDED",
    input.razorpayPaymentId,
  );

  return { refund, payment };
}

/** True when the refund covers the full captured amount (to the paise). */
export function isFullRefund(
  capturedAmountRupees: number,
  refundAmountRupees?: number,
): boolean {
  if (refundAmountRupees === undefined) return true;
  return toPaise(refundAmountRupees) === toPaise(capturedAmountRupees);
}
