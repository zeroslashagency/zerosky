// @zerosky/payments — reconciliation
// Compares local payment rows for an order against the gateway's view and
// reports mismatches (amount drift, status drift, orphans on either side).
// This is a read-only diagnostic; it does not mutate state.

import { rupeesEqual, toRupees } from "./money.js";
import type { PaymentRecord } from "./repository.js";
import { fromRazorpayStatus } from "./state.js";
import type { PaymentStatus, RazorpayPaymentResult } from "./types.js";

/** A single gateway payment, keyed for reconciliation. */
export interface GatewayPayment {
  /** Gateway order id used to correlate with the local `reference`. */
  orderId: string | null;
  /** Gateway payment entity. */
  payment: RazorpayPaymentResult;
}

/** Category of a reconciliation discrepancy. */
export type DiscrepancyKind =
  | "AMOUNT_MISMATCH"
  | "STATUS_MISMATCH"
  | "MISSING_IN_GATEWAY"
  | "MISSING_LOCALLY";

/** A single reconciliation discrepancy. */
export interface Discrepancy {
  kind: DiscrepancyKind;
  reference: string | null;
  localPaymentId?: string;
  gatewayPaymentId?: string;
  detail: string;
}

/** Outcome of a reconciliation run. */
export interface ReconciliationReport {
  matched: number;
  discrepancies: Discrepancy[];
  /** True when there are no discrepancies. */
  balanced: boolean;
}

/**
 * Reconcile local payment records against gateway payments. Correlation is by
 * the gateway order id: local rows keep it in `reference`, gateway payments
 * expose it as `orderId`. Only CARD/UPI/WALLET rows are expected to exist in
 * the gateway, so cash/complimentary local rows are skipped.
 */
export function reconcile(
  localPayments: PaymentRecord[],
  gatewayPayments: GatewayPayment[],
): ReconciliationReport {
  const discrepancies: Discrepancy[] = [];
  let matched = 0;

  const gatewayByOrder = new Map<string, GatewayPayment>();
  for (const gw of gatewayPayments) {
    if (gw.orderId) gatewayByOrder.set(gw.orderId, gw);
  }

  const seenGatewayOrders = new Set<string>();
  const gatewayBackedMethods = new Set<PaymentStatus | string>();
  gatewayBackedMethods.add("CARD");
  gatewayBackedMethods.add("UPI");
  gatewayBackedMethods.add("WALLET");

  for (const local of localPayments) {
    // Cash/complimentary never reach the gateway; nothing to reconcile.
    if (!gatewayBackedMethods.has(local.method)) {
      continue;
    }
    const ref = local.reference;
    if (!ref) {
      discrepancies.push({
        kind: "MISSING_IN_GATEWAY",
        reference: null,
        localPaymentId: local.id,
        detail: "Local payment has no gateway reference",
      });
      continue;
    }

    const gw = gatewayByOrder.get(ref);
    if (!gw) {
      discrepancies.push({
        kind: "MISSING_IN_GATEWAY",
        reference: ref,
        localPaymentId: local.id,
        detail: `No gateway payment for order ${ref}`,
      });
      continue;
    }

    seenGatewayOrders.add(ref);

    const gatewayAmountRupees = toRupees(gw.payment.amount);
    if (!rupeesEqual(gatewayAmountRupees, local.amount)) {
      discrepancies.push({
        kind: "AMOUNT_MISMATCH",
        reference: ref,
        localPaymentId: local.id,
        gatewayPaymentId: gw.payment.id,
        detail: `Local ₹${local.amount} vs gateway ₹${gatewayAmountRupees}`,
      });
    }

    const gatewayStatus = fromRazorpayStatus(gw.payment.status);
    if (gatewayStatus !== local.status) {
      discrepancies.push({
        kind: "STATUS_MISMATCH",
        reference: ref,
        localPaymentId: local.id,
        gatewayPaymentId: gw.payment.id,
        detail: `Local ${local.status} vs gateway ${gatewayStatus}`,
      });
    }

    if (discrepanciesForRef(discrepancies, ref) === 0) {
      matched += 1;
    }
  }

  // Gateway payments with no local counterpart.
  for (const gw of gatewayPayments) {
    if (!gw.orderId || seenGatewayOrders.has(gw.orderId)) continue;
    discrepancies.push({
      kind: "MISSING_LOCALLY",
      reference: gw.orderId,
      gatewayPaymentId: gw.payment.id,
      detail: `Gateway payment ${gw.payment.id} has no local record`,
    });
  }

  return {
    matched,
    discrepancies,
    balanced: discrepancies.length === 0,
  };
}

/** Count discrepancies recorded for a given reference. */
function discrepanciesForRef(discrepancies: Discrepancy[], ref: string): number {
  return discrepancies.filter((d) => d.reference === ref).length;
}
