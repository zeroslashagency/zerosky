// @zerosky/payments — payment state machine
// PENDING → CAPTURED | FAILED, CAPTURED → REFUNDED. All other moves are invalid.
// PaymentStatus is the same enum used by the Prisma schema (payments.status).

import type { PaymentStatus } from "./types.js";

/** Allowed target states from each source state. */
const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ["CAPTURED", "FAILED"],
  CAPTURED: ["REFUNDED"],
  FAILED: [],
  REFUNDED: [],
};

/** States from which no further transition is possible. */
export function isTerminal(state: PaymentStatus): boolean {
  return TRANSITIONS[state].length === 0;
}

/** True when moving `from → to` is a legal transition. */
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Thrown when an illegal state transition is attempted. */
export class InvalidTransitionError extends Error {
  readonly from: PaymentStatus;
  readonly to: PaymentStatus;

  constructor(from: PaymentStatus, to: PaymentStatus) {
    super(`Invalid payment transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}

/**
 * Assert and return the next state. Throws {@link InvalidTransitionError} if
 * the transition is not permitted, so callers can rely on the return value.
 */
export function transition(from: PaymentStatus, to: PaymentStatus): PaymentStatus {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  return to;
}

/** List the legal next states for a given state (empty when terminal). */
export function nextStates(from: PaymentStatus): readonly PaymentStatus[] {
  return TRANSITIONS[from];
}

/**
 * Map a Razorpay payment entity status to a zerosky {@link PaymentStatus}.
 * Razorpay statuses: created, authorized, captured, refunded, failed.
 */
export function fromRazorpayStatus(razorpayStatus: string): PaymentStatus {
  switch (razorpayStatus) {
    case "captured":
      return "CAPTURED";
    case "refunded":
      return "REFUNDED";
    case "failed":
      return "FAILED";
    case "created":
    case "authorized":
    default:
      return "PENDING";
  }
}
