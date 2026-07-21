// @zerosky/payments — Razorpay SDK wrapper
// A thin, typed adapter over the `razorpay` SDK. Keeps the rest of the package
// free of SDK-specific shapes and makes the gateway trivial to mock in tests.

import Razorpay from "razorpay";
import { toPaise } from "./money.js";
import type {
  CurrencyCode,
  Paise,
  RazorpayCredentials,
  RazorpayOrderResult,
  RazorpayPaymentResult,
  RazorpayRefundResult,
} from "./types.js";

/** Subset of the razorpay SDK surface this package depends on. */
export interface RazorpayLike {
  orders: {
    create(params: {
      amount: Paise;
      currency: string;
      receipt?: string;
      notes?: Record<string, string>;
    }): Promise<{
      id: string;
      amount: number | string;
      currency: string;
      status: string;
      receipt?: string;
    }>;
  };
  payments: {
    fetch(paymentId: string): Promise<{
      id: string;
      order_id: string | null;
      amount: number | string;
      currency: string;
      status: string;
      method: string;
      captured: boolean;
    }>;
    capture(
      paymentId: string,
      amount: Paise,
      currency: string,
    ): Promise<{
      id: string;
      order_id: string | null;
      amount: number | string;
      currency: string;
      status: string;
      method: string;
      captured: boolean;
    }>;
    refund(
      paymentId: string,
      params: { amount?: Paise; notes?: Record<string, string> },
    ): Promise<{
      id: string;
      payment_id: string;
      amount: number | string;
      status: string;
    }>;
  };
  refunds: {
    fetch(refundId: string): Promise<{
      id: string;
      payment_id: string;
      amount: number | string;
      status: string;
    }>;
  };
}

function toNumber(value: number | string): number {
  return typeof value === "string" ? Number(value) : value;
}

/**
 * Typed wrapper around a Razorpay client. Inject any {@link RazorpayLike}
 * (real SDK instance or a mock) for testability.
 */
export class RazorpayGateway {
  private readonly client: RazorpayLike;

  constructor(client: RazorpayLike) {
    this.client = client;
  }

  /** Construct a gateway backed by the real razorpay SDK. */
  static fromCredentials(credentials: RazorpayCredentials): RazorpayGateway {
    const client = new Razorpay({
      key_id: credentials.keyId,
      key_secret: credentials.keySecret,
    }) as unknown as RazorpayLike;
    return new RazorpayGateway(client);
  }

  /** Create a Razorpay order. `amountRupees` is converted to paise internally. */
  async createOrder(params: {
    amountRupees: number;
    currency?: CurrencyCode;
    receipt?: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayOrderResult> {
    const order = await this.client.orders.create({
      amount: toPaise(params.amountRupees),
      currency: params.currency ?? "INR",
      receipt: params.receipt,
      notes: params.notes,
    });
    return {
      id: order.id,
      amount: toNumber(order.amount),
      currency: order.currency,
      status: order.status,
      receipt: order.receipt,
    };
  }

  /** Fetch a payment entity by id. */
  async fetchPayment(paymentId: string): Promise<RazorpayPaymentResult> {
    const payment = await this.client.payments.fetch(paymentId);
    return this.normalisePayment(payment);
  }

  /** Capture an authorized payment for the given rupee amount. */
  async capturePayment(
    paymentId: string,
    amountRupees: number,
    currency: CurrencyCode = "INR",
  ): Promise<RazorpayPaymentResult> {
    const payment = await this.client.payments.capture(
      paymentId,
      toPaise(amountRupees),
      currency,
    );
    return this.normalisePayment(payment);
  }

  /**
   * Create a refund. Omit `amountRupees` for a full refund; pass it for a
   * partial refund.
   */
  async createRefund(
    paymentId: string,
    amountRupees?: number,
    notes?: Record<string, string>,
  ): Promise<RazorpayRefundResult> {
    const refund = await this.client.payments.refund(paymentId, {
      amount: amountRupees === undefined ? undefined : toPaise(amountRupees),
      notes,
    });
    return {
      id: refund.id,
      paymentId: refund.payment_id,
      amount: toNumber(refund.amount),
      status: refund.status,
    };
  }

  /** Fetch a refund entity by id. */
  async fetchRefund(refundId: string): Promise<RazorpayRefundResult> {
    const refund = await this.client.refunds.fetch(refundId);
    return {
      id: refund.id,
      paymentId: refund.payment_id,
      amount: toNumber(refund.amount),
      status: refund.status,
    };
  }

  private normalisePayment(payment: {
    id: string;
    order_id: string | null;
    amount: number | string;
    currency: string;
    status: string;
    method: string;
    captured: boolean;
  }): RazorpayPaymentResult {
    return {
      id: payment.id,
      orderId: payment.order_id,
      amount: toNumber(payment.amount),
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      captured: payment.captured,
    };
  }
}
