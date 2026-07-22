// @zerosky/payments — shared types
// Money is handled in integer minor units (paise) at the gateway boundary to
// avoid floating-point drift; rupee Decimals live in the database layer.

import type { PaymentMethod, PaymentStatus } from "@zerosky/database";

export type { PaymentMethod, PaymentStatus };

/** Razorpay operates in the smallest currency subunit (paise for INR). */
export type Paise = number;

/** ISO 4217 currency code. Zerosky is India-first, so INR by default. */
export type CurrencyCode = "INR";

/** Credentials for a Razorpay API client. */
export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

/** Configuration for the payments package. */
export interface PaymentsConfig {
  razorpay: RazorpayCredentials;
  /** Secret used to verify inbound webhook signatures. */
  webhookSecret: string;
}

/** A single tender line in a (possibly split) payment. */
export interface Tender {
  method: PaymentMethod;
  /** Amount for this tender, in rupees. */
  amount: number;
  /** Optional gateway/UPI reference. */
  reference?: string;
}

/** Normalised result of a Razorpay order creation. */
export interface RazorpayOrderResult {
  id: string;
  amount: Paise;
  currency: string;
  status: string;
  receipt?: string;
}

/** Normalised Razorpay payment entity. */
export interface RazorpayPaymentResult {
  id: string;
  orderId: string | null;
  amount: Paise;
  currency: string;
  status: string;
  method: string;
  captured: boolean;
}

/** Normalised Razorpay refund entity. */
export interface RazorpayRefundResult {
  id: string;
  paymentId: string;
  amount: Paise;
  status: string;
}
