// Shared test doubles: in-memory repository and a Razorpay SDK mock.
// No live DB or network — everything runs deterministically in CI.

import type { RazorpayLike } from "../src/razorpay.js";
import type {
  CreatePaymentInput,
  PaymentRecord,
  PaymentRepository,
} from "../src/repository.js";
import type { PaymentStatus } from "../src/types.js";

/** In-memory PaymentRepository for tests. */
export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly rows = new Map<string, PaymentRecord>();
  private counter = 0;

  async create(input: CreatePaymentInput): Promise<PaymentRecord> {
    const id = `pay_${++this.counter}`;
    const record: PaymentRecord = {
      id,
      branchId: input.branchId,
      orderId: input.orderId,
      method: input.method,
      status: input.status ?? "PENDING",
      amount: input.amount,
      reference: input.reference ?? null,
    };
    this.rows.set(id, record);
    return { ...record };
  }

  async findById(id: string): Promise<PaymentRecord | null> {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  }

  async findByOrderId(orderId: string): Promise<PaymentRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.orderId === orderId)
      .map((r) => ({ ...r }));
  }

  async findByReference(reference: string): Promise<PaymentRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.reference === reference)
      .map((r) => ({ ...r }));
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    reference?: string | null,
  ): Promise<PaymentRecord> {
    const row = this.rows.get(id);
    if (!row) throw new Error(`Payment not found: ${id}`);
    row.status = status;
    if (reference !== undefined) row.reference = reference;
    this.rows.set(id, row);
    return { ...row };
  }

  /** Test-only: total rows. */
  size(): number {
    return this.rows.size;
  }
}

/** Options controlling the mock gateway's returned entities. */
export interface MockGatewayOptions {
  orderId?: string;
  paymentStatus?: string;
  paymentAmountPaise?: number;
  paymentOrderId?: string | null;
  refundStatus?: string;
}

/** Build a razorpay SDK mock ({@link RazorpayLike}) with spy-able calls. */
export function createMockRazorpay(options: MockGatewayOptions = {}): RazorpayLike {
  const {
    orderId = "order_test_1",
    paymentStatus = "captured",
    paymentAmountPaise = 10000,
    paymentOrderId = orderId,
    refundStatus = "processed",
  } = options;

  return {
    orders: {
      create: async (params) => ({
        id: orderId,
        amount: params.amount,
        currency: params.currency,
        status: "created",
        receipt: params.receipt,
      }),
    },
    payments: {
      fetch: async (paymentId) => ({
        id: paymentId,
        order_id: paymentOrderId,
        amount: paymentAmountPaise,
        currency: "INR",
        status: paymentStatus,
        method: "card",
        captured: paymentStatus === "captured",
      }),
      capture: async (paymentId, amount) => ({
        id: paymentId,
        order_id: paymentOrderId,
        amount,
        currency: "INR",
        status: "captured",
        method: "card",
        captured: true,
      }),
      refund: async (paymentId, params) => ({
        id: "rfnd_test_1",
        payment_id: paymentId,
        amount: params.amount ?? paymentAmountPaise,
        status: refundStatus,
      }),
    },
    refunds: {
      fetch: async (refundId) => ({
        id: refundId,
        payment_id: "pay_gw_1",
        amount: paymentAmountPaise,
        status: refundStatus,
      }),
    },
  };
}
