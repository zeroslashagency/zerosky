// @zerosky/payments — webhook signature verification
// Razorpay signs webhook bodies with HMAC-SHA256 over the raw request body,
// keyed by the webhook secret. Verify against the raw bytes (never re-serialise
// the JSON) so the digest matches exactly.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentRepository, PaymentRecord } from "./repository.js";
import { canTransition, fromRazorpayStatus } from "./state.js";
import type { PaymentStatus } from "./types.js";

/** Thrown when a webhook signature fails verification. */
export class WebhookVerificationError extends Error {
  constructor(message = "Razorpay webhook signature verification failed") {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/**
 * Verify a Razorpay webhook signature.
 * `rawBody` MUST be the exact bytes received, not a re-serialised object.
 * Comparison is constant-time to avoid timing attacks.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  webhookSecret: string,
): boolean {
  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/** Minimal shape of the Razorpay webhook payload we consume. */
export interface RazorpayWebhookEvent {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string | null;
        status: string;
      };
    };
    refund?: {
      entity: {
        id: string;
        payment_id: string;
        status: string;
      };
    };
  };
}

/**
 * Parse a raw webhook body into a typed event after verifying its signature.
 * Throws {@link WebhookVerificationError} if the signature is invalid.
 */
export function parseWebhookEvent(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): RazorpayWebhookEvent {
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    throw new WebhookVerificationError();
  }
  return JSON.parse(rawBody) as RazorpayWebhookEvent;
}

/** Map a Razorpay webhook event name to a target {@link PaymentStatus}. */
export function statusForEvent(event: RazorpayWebhookEvent): PaymentStatus | null {
  switch (event.event) {
    case "payment.captured":
      return "CAPTURED";
    case "payment.failed":
      return "FAILED";
    case "refund.processed":
    case "refund.created":
      return "REFUNDED";
    case "payment.authorized":
    case "payment.created": {
      // authorized/created keep PENDING idempotently; but if the embedded
      // entity already reflects a terminal status (captured/failed/refunded)
      // honor it so the webhook can still drive the transition.
      const entityStatus = event.payload.payment?.entity.status;
      if (entityStatus) {
        const mapped = fromRazorpayStatus(entityStatus);
        if (mapped !== "PENDING") return mapped;
      }
      return "PENDING";
    }
    default: {
      // Fall back to the embedded payment entity status when present.
      const entityStatus = event.payload.payment?.entity.status;
      return entityStatus ? fromRazorpayStatus(entityStatus) : null;
    }
  }
}

/** Result of handling a webhook event. */
export interface WebhookHandleResult {
  handled: boolean;
  payment?: PaymentRecord;
  reason?: string;
}

/**
 * Verify and apply a webhook event to local payment state. Locates the local
 * payment by the gateway order id (stored in `reference` when the payment was
 * started) and applies a legal state transition. Unknown or out-of-order
 * events are ignored idempotently rather than throwing.
 */
export async function handleWebhookEvent(
  repository: PaymentRepository,
  rawBody: string,
  signature: string,
  webhookSecret: string,
): Promise<WebhookHandleResult> {
  const event = parseWebhookEvent(rawBody, signature, webhookSecret);
  const nextStatus = statusForEvent(event);
  if (!nextStatus) {
    return { handled: false, reason: `Unhandled event: ${event.event}` };
  }

  const paymentEntity = event.payload.payment?.entity;
  const refundEntity = event.payload.refund?.entity;
  const orderId = paymentEntity?.order_id ?? null;
  const gatewayPaymentId = paymentEntity?.id ?? refundEntity?.payment_id ?? null;

  if (!orderId && !gatewayPaymentId) {
    return { handled: false, reason: "Event missing order/payment reference" };
  }

  // Event-id dedupe / reference correlation:
  // - Local payments store the gateway order id in `reference` at start time.
  // - But order_id can be ambiguous (null or shared). Prefer gatewayPaymentId when available,
  //   falling back to order_id. findByReference is tried for both.
  let target: PaymentRecord | null = null;

  if (gatewayPaymentId) {
    const byPaymentId = await repository.findByReference(gatewayPaymentId);
    target = byPaymentId[0] ?? null;
    // If the payment record already has its payment-id as reference and status matches,
    // this is a replay — idempotent early return (covers event-id dedupe via state).
    if (target && target.status === nextStatus) {
      return { handled: true, payment: target };
    }
  }

  if (!target && orderId) {
    const candidates = await repository.findByReference(orderId);
    target = candidates.find((p) => p.reference === orderId) ?? candidates[0] ?? null;
  }

  // Fallback: if only gatewayPaymentId existed and we didn't resolve via it as order,
  // try it again as a secondary lookup (covers cases where orderId was null).
  if (!target && gatewayPaymentId) {
    const candidates = await repository.findByReference(gatewayPaymentId);
    target = candidates[0] ?? null;
  }

  if (!target) {
    return { handled: false, reason: "No matching local payment" };
  }

  if (target.status === nextStatus) {
    // Idempotent: already in the target state. PENDING→PENDING is intentionally
    // handled:true (authorized/created replays must not be "Illegal transition").
    return { handled: true, payment: target };
  }

  if (!canTransition(target.status, nextStatus)) {
    return {
      handled: false,
      payment: target,
      reason: `Illegal transition ${target.status} → ${nextStatus}`,
    };
  }

  const updated = await repository.updateStatus(
    target.id,
    nextStatus,
    gatewayPaymentId ?? target.reference,
  );
  return { handled: true, payment: updated };
}
