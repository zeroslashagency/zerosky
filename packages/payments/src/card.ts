// @zerosky/payments — card payment flow (Razorpay Checkout)
// Produces the options a client hands to Razorpay Checkout, records a PENDING
// payment, and verifies the checkout handshake signature on success.

import { createHmac, timingSafeEqual } from "node:crypto";
import { RazorpayGateway } from "./razorpay.js";
import type { PaymentRepository, PaymentRecord } from "./repository.js";
import { fromRazorpayStatus, transition } from "./state.js";
import { toPaise } from "./money.js";
import type { Paise } from "./types.js";

/** Parameters to begin a card payment for an order. */
export interface StartCardPaymentInput {
  branchId: string;
  orderId: string;
  amountRupees: number;
  receipt?: string;
}

/** Options the frontend passes to Razorpay Checkout. */
export interface CheckoutOptions {
  key: string;
  amount: Paise;
  currency: "INR";
  order_id: string;
  name?: string;
  description?: string;
}

/** Result of starting a card payment. */
export interface StartCardPaymentResult {
  paymentId: string;
  checkout: CheckoutOptions;
}

/**
 * Start a card payment: create a Razorpay order, a PENDING payment row, and the
 * Checkout options object for the client.
 */
export async function startCardPayment(
  gateway: RazorpayGateway,
  repository: PaymentRepository,
  keyId: string,
  input: StartCardPaymentInput,
): Promise<StartCardPaymentResult> {
  const order = await gateway.createOrder({
    amountRupees: input.amountRupees,
    currency: "INR",
    receipt: input.receipt ?? `card_${input.orderId}`,
    notes: { flow: "card", orderId: input.orderId },
  });

  const payment = await repository.create({
    branchId: input.branchId,
    orderId: input.orderId,
    method: "CARD",
    amount: input.amountRupees,
    status: "PENDING",
    reference: order.id,
  });

  return {
    paymentId: payment.id,
    checkout: {
      key: keyId,
      amount: toPaise(input.amountRupees),
      currency: "INR",
      order_id: order.id,
      name: "zerosky",
      description: `Order ${input.orderId}`,
    },
  };
}

/** The three fields Razorpay Checkout returns to the client on success. */
export interface CheckoutHandshake {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Verify the Razorpay Checkout signature:
 * HMAC_SHA256(order_id + "|" + payment_id, key_secret) === razorpay_signature.
 * Uses a constant-time comparison to avoid timing leaks.
 */
export function verifyCheckoutSignature(
  handshake: CheckoutHandshake,
  keySecret: string,
): boolean {
  const payload = `${handshake.razorpay_order_id}|${handshake.razorpay_payment_id}`;
  const expected = createHmac("sha256", keySecret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(handshake.razorpay_signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/** Thrown when a checkout signature fails verification. */
export class SignatureVerificationError extends Error {
  constructor(message = "Razorpay checkout signature verification failed") {
    super(message);
    this.name = "SignatureVerificationError";
  }
}

/**
 * Confirm a card payment after Checkout: verify the signature, then fetch the
 * gateway payment and persist the resulting state transition.
 */
export async function confirmCardPayment(
  gateway: RazorpayGateway,
  repository: PaymentRepository,
  keySecret: string,
  localPaymentId: string,
  handshake: CheckoutHandshake,
): Promise<PaymentRecord> {
  if (!verifyCheckoutSignature(handshake, keySecret)) {
    throw new SignatureVerificationError();
  }

  const existing = await repository.findById(localPaymentId);
  if (!existing) {
    throw new Error(`Payment not found: ${localPaymentId}`);
  }

  const gatewayPayment = await gateway.fetchPayment(handshake.razorpay_payment_id);
  const nextStatus = fromRazorpayStatus(gatewayPayment.status);
  transition(existing.status, nextStatus);

  return repository.updateStatus(
    localPaymentId,
    nextStatus,
    handshake.razorpay_payment_id,
  );
}
