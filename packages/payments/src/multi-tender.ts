// @zerosky/payments — multi-tender (split) payments
// A bill can be settled with several tenders (e.g. 50% cash + 50% UPI). We
// validate the split sums to the grand total to the paise before persisting.

import { rupeesEqual, sumRupees, toPaise, toRupees } from "./money.js";
import type { PaymentRepository, PaymentRecord } from "./repository.js";
import type { PaymentMethod, Tender } from "./types.js";

/** Cash/complimentary tenders settle instantly; gateway tenders start PENDING. */
const INSTANT_METHODS: ReadonlySet<PaymentMethod> = new Set<PaymentMethod>([
  "CASH",
  "COMPLIMENTARY",
]);

/** Thrown when tenders don't add up to the expected grand total. */
export class SplitMismatchError extends Error {
  readonly expected: number;
  readonly received: number;

  constructor(expected: number, received: number) {
    super(
      `Split tenders total ₹${received.toFixed(2)} does not match grand total ₹${expected.toFixed(2)}`,
    );
    this.name = "SplitMismatchError";
    this.expected = expected;
    this.received = received;
  }
}

/** Input for settling an order with one or more tenders. */
export interface SplitPaymentInput {
  branchId: string;
  orderId: string;
  /** The bill grand total, in rupees. */
  grandTotal: number;
  tenders: Tender[];
}

/**
 * Validate that the tenders exactly settle the grand total. Throws
 * {@link SplitMismatchError} otherwise. Returns the validated total.
 */
export function validateSplit(grandTotal: number, tenders: Tender[]): number {
  if (tenders.length === 0) {
    throw new SplitMismatchError(grandTotal, 0);
  }
  for (const tender of tenders) {
    if (toPaise(tender.amount) <= 0) {
      throw new SplitMismatchError(grandTotal, tender.amount);
    }
  }
  const received = sumRupees(tenders.map((t) => t.amount));
  if (!rupeesEqual(received, grandTotal)) {
    throw new SplitMismatchError(grandTotal, received);
  }
  return received;
}

/**
 * Build an even split of `grandTotal` across the given methods, assigning any
 * rounding remainder (in paise) to the first tender so the sum stays exact.
 * e.g. splitEvenly(100, ["CASH","UPI"]) → [{CASH,50},{UPI,50}].
 */
export function splitEvenly(
  grandTotal: number,
  methods: PaymentMethod[],
): Tender[] {
  if (methods.length === 0) {
    throw new SplitMismatchError(grandTotal, 0);
  }
  const totalPaise = toPaise(grandTotal);
  const base = Math.floor(totalPaise / methods.length);
  const remainder = totalPaise - base * methods.length;
  return methods.map((method, index) => ({
    method,
    amount: toRupees(base + (index === 0 ? remainder : 0)),
  }));
}

/**
 * Settle an order with a split payment. Validates the split, then creates one
 * payment row per tender. Cash/complimentary tenders are CAPTURED immediately;
 * gateway-backed tenders (CARD/UPI/WALLET/AGGREGATOR) start PENDING and are
 * confirmed by their own flow.
 */
export async function settleSplitPayment(
  repository: PaymentRepository,
  input: SplitPaymentInput,
): Promise<PaymentRecord[]> {
  validateSplit(input.grandTotal, input.tenders);

  const records: PaymentRecord[] = [];
  for (const tender of input.tenders) {
    const record = await repository.create({
      branchId: input.branchId,
      orderId: input.orderId,
      method: tender.method,
      amount: tender.amount,
      status: INSTANT_METHODS.has(tender.method) ? "CAPTURED" : "PENDING",
      reference: tender.reference ?? null,
    });
    records.push(record);
  }
  return records;
}
