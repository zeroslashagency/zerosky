// @zerosky/payments — UPI payment flow
// Creates a Razorpay order for a UPI collect/intent payment and records a
// PENDING payment row. Capture is confirmed later via webhook or verification.

import { RazorpayGateway } from "./razorpay.js";
import type { PaymentRepository, PaymentRecord } from "./repository.js";
import { fromRazorpayStatus, transition } from "./state.js";
import type { RazorpayOrderResult } from "./types.js";

/** Parameters to begin a UPI payment for an order. */
export interface StartUpiPaymentInput {
  branchId: string;
  orderId: string;
  amountRupees: number;
  /** Payer VPA (e.g. "name@bank"); attached as a note for reconciliation. */
  vpa?: string;
  receipt?: string;
}

/** Result of starting a UPI payment: the gateway order + local payment id. */
export interface StartUpiPaymentResult {
  paymentId: string;
  order: RazorpayOrderResult;
}

/**
 * Start a UPI payment. Creates a Razorpay order and a local PENDING payment
 * row keyed by the gateway order id (stored in `reference`).
 */
export async function startUpiPayment(
  gateway: RazorpayGateway,
  repository: PaymentRepository,
  input: StartUpiPaymentInput,
): Promise<StartUpiPaymentResult> {
  const notes: Record<string, string> = { flow: "upi", orderId: input.orderId };
  if (input.vpa) notes.vpa = input.vpa;

  const order = await gateway.createOrder({
    amountRupees: input.amountRupees,
    currency: "INR",
    receipt: input.receipt ?? `upi_${input.orderId}`,
    notes,
  });

  const payment = await repository.create({
    branchId: input.branchId,
    orderId: input.orderId,
    method: "UPI",
    amount: input.amountRupees,
    status: "PENDING",
    reference: order.id,
  });

  return { paymentId: payment.id, order };
}

/**
 * Confirm a UPI payment against the gateway. Fetches the Razorpay payment,
 * maps its status through the state machine, and persists the transition.
 */
export async function confirmUpiPayment(
  gateway: RazorpayGateway,
  repository: PaymentRepository,
  localPaymentId: string,
  razorpayPaymentId: string,
): Promise<PaymentRecord> {
  const existing = await repository.findById(localPaymentId);
  if (!existing) {
    throw new Error(`Payment not found: ${localPaymentId}`);
  }

  const gatewayPayment = await gateway.fetchPayment(razorpayPaymentId);
  const nextStatus = fromRazorpayStatus(gatewayPayment.status);

  // Validate the transition (throws on illegal moves such as PENDING → PENDING).
  transition(existing.status, nextStatus);

  return repository.updateStatus(localPaymentId, nextStatus, razorpayPaymentId);
}
