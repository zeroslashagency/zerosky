// @zerosky/payments — money helpers
// Razorpay works in paise (integer minor units). Converting through integers
// avoids the classic 0.1 + 0.2 float problem when we round rupee amounts.

import type { Paise } from "./types.js";

/** Thrown when a monetary value is invalid (NaN, negative, or non-finite). */
export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

/**
 * Convert a rupee amount to paise.
 * Rounds to the nearest paise to absorb binary float representation error.
 */
export function toPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) {
    throw new InvalidAmountError(`Amount must be a finite number, got ${rupees}`);
  }
  if (rupees < 0) {
    throw new InvalidAmountError(`Amount must not be negative, got ${rupees}`);
  }
  return Math.round(rupees * 100);
}

/** Convert paise (integer) back to a rupee amount with 2 decimals. */
export function toRupees(paise: Paise): number {
  if (!Number.isInteger(paise)) {
    throw new InvalidAmountError(`Paise must be an integer, got ${paise}`);
  }
  return paise / 100;
}

/**
 * Sum a list of rupee amounts without accumulating float error, by summing in
 * paise and converting back.
 */
export function sumRupees(amounts: number[]): number {
  const totalPaise = amounts.reduce((acc, amount) => acc + toPaise(amount), 0);
  return toRupees(totalPaise);
}

/** True when two rupee amounts are equal to the paise. */
export function rupeesEqual(a: number, b: number): boolean {
  return toPaise(a) === toPaise(b);
}
