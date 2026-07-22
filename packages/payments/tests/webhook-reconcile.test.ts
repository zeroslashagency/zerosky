import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  handleWebhookEvent,
  parseWebhookEvent,
  statusForEvent,
  verifyWebhookSignature,
  WebhookVerificationError,
} from "../src/webhook.js";
import { reconcile, type GatewayPayment } from "../src/reconcile.js";
import type { PaymentRecord } from "../src/repository.js";
import { InMemoryPaymentRepository } from "./helpers.js";

const SECRET = "whsec_test";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

function eventBody(
  event: string,
  entity: { id: string; order_id: string | null; status: string },
): string {
  return JSON.stringify({
    event,
    payload: { payment: { entity } },
  });
}

describe("webhook signature", () => {
  it("verifies a correct signature", () => {
    const body = eventBody("payment.captured", {
      id: "pay_1",
      order_id: "order_1",
      status: "captured",
    });
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    const body = eventBody("payment.captured", {
      id: "pay_1",
      order_id: "order_1",
      status: "captured",
    });
    expect(verifyWebhookSignature(body, "abcd", SECRET)).toBe(false);
  });

  it("rejects a non-hex signature safely", () => {
    const body = "{}";
    expect(verifyWebhookSignature(body, "zzzz", SECRET)).toBe(false);
  });

  it("parseWebhookEvent throws on bad signature", () => {
    const body = eventBody("payment.captured", {
      id: "pay_1",
      order_id: "order_1",
      status: "captured",
    });
    expect(() => parseWebhookEvent(body, "00", SECRET)).toThrow(
      WebhookVerificationError,
    );
  });

  it("maps events to statuses", () => {
    expect(
      statusForEvent({ event: "payment.captured", payload: {} }),
    ).toBe("CAPTURED");
    expect(statusForEvent({ event: "payment.failed", payload: {} })).toBe(
      "FAILED",
    );
    expect(
      statusForEvent({ event: "refund.processed", payload: {} }),
    ).toBe("REFUNDED");
    expect(
      statusForEvent({
        event: "payment.authorized",
        payload: {
          payment: { entity: { id: "p", order_id: "o", status: "captured" } },
        },
      }),
    ).toBe("CAPTURED");
    expect(statusForEvent({ event: "order.paid", payload: {} })).toBeNull();
  });
});

describe("handleWebhookEvent", () => {
  it("applies a capture to a pending payment", async () => {
    const repo = new InMemoryPaymentRepository();
    await repo.create({
      branchId: "b1",
      orderId: "o1",
      method: "UPI",
      amount: 100,
      status: "PENDING",
      reference: "order_1",
    });

    const body = eventBody("payment.captured", {
      id: "pay_gw",
      order_id: "order_1",
      status: "captured",
    });
    const result = await handleWebhookEvent(repo, body, sign(body), SECRET);
    expect(result.handled).toBe(true);
    expect(result.payment?.status).toBe("CAPTURED");
    expect(result.payment?.reference).toBe("pay_gw");
  });

  it("is idempotent when already in the target state", async () => {
    const repo = new InMemoryPaymentRepository();
    await repo.create({
      branchId: "b1",
      orderId: "o1",
      method: "UPI",
      amount: 100,
      status: "CAPTURED",
      reference: "order_1",
    });
    const body = eventBody("payment.captured", {
      id: "pay_gw",
      order_id: "order_1",
      status: "captured",
    });
    const result = await handleWebhookEvent(repo, body, sign(body), SECRET);
    expect(result.handled).toBe(true);
    expect(result.payment?.status).toBe("CAPTURED");
  });

  it("reports an illegal transition without mutating", async () => {
    const repo = new InMemoryPaymentRepository();
    const created = await repo.create({
      branchId: "b1",
      orderId: "o1",
      method: "UPI",
      amount: 100,
      status: "FAILED",
      reference: "order_1",
    });
    const body = eventBody("payment.captured", {
      id: "pay_gw",
      order_id: "order_1",
      status: "captured",
    });
    const result = await handleWebhookEvent(repo, body, sign(body), SECRET);
    expect(result.handled).toBe(false);
    expect(result.reason).toMatch(/Illegal transition/);
    const stored = await repo.findById(created.id);
    expect(stored?.status).toBe("FAILED");
  });

  it("ignores unhandled events", async () => {
    const repo = new InMemoryPaymentRepository();
    const body = JSON.stringify({ event: "order.paid", payload: {} });
    const result = await handleWebhookEvent(repo, body, sign(body), SECRET);
    expect(result.handled).toBe(false);
    expect(result.reason).toMatch(/Unhandled event/);
  });

  it("reports no matching local payment", async () => {
    const repo = new InMemoryPaymentRepository();
    const body = eventBody("payment.captured", {
      id: "pay_gw",
      order_id: "order_unknown",
      status: "captured",
    });
    const result = await handleWebhookEvent(repo, body, sign(body), SECRET);
    expect(result.handled).toBe(false);
    expect(result.reason).toMatch(/No matching local payment/);
  });
});

describe("reconcile", () => {
  const gwPayment = (
    orderId: string,
    status: string,
    amountPaise: number,
  ): GatewayPayment => ({
    orderId,
    payment: {
      id: `pay_${orderId}`,
      orderId,
      amount: amountPaise,
      currency: "INR",
      status,
      method: "card",
      captured: status === "captured",
    },
  });

  const local = (over: Partial<PaymentRecord>): PaymentRecord => ({
    id: "pay_1",
    branchId: "b1",
    orderId: "o1",
    method: "CARD",
    status: "CAPTURED",
    amount: 100,
    reference: "order_1",
    ...over,
  });

  it("balances when local and gateway agree", () => {
    const report = reconcile(
      [local({})],
      [gwPayment("order_1", "captured", 10000)],
    );
    expect(report.balanced).toBe(true);
    expect(report.matched).toBe(1);
  });

  it("skips cash tenders", () => {
    const report = reconcile(
      [local({ method: "CASH", reference: null })],
      [],
    );
    expect(report.balanced).toBe(true);
    expect(report.discrepancies).toHaveLength(0);
  });

  it("flags amount mismatch", () => {
    const report = reconcile(
      [local({})],
      [gwPayment("order_1", "captured", 9000)],
    );
    expect(report.balanced).toBe(false);
    expect(report.discrepancies[0]?.kind).toBe("AMOUNT_MISMATCH");
  });

  it("flags status mismatch", () => {
    const report = reconcile(
      [local({ status: "PENDING" })],
      [gwPayment("order_1", "captured", 10000)],
    );
    expect(report.discrepancies.some((d) => d.kind === "STATUS_MISMATCH")).toBe(
      true,
    );
  });

  it("flags a local payment missing in gateway", () => {
    const report = reconcile([local({})], []);
    expect(report.discrepancies[0]?.kind).toBe("MISSING_IN_GATEWAY");
  });

  it("flags a local payment with no reference", () => {
    const report = reconcile([local({ reference: null })], []);
    expect(report.discrepancies[0]?.kind).toBe("MISSING_IN_GATEWAY");
    expect(report.discrepancies[0]?.detail).toMatch(/no gateway reference/);
  });

  it("flags a gateway payment missing locally", () => {
    const report = reconcile(
      [],
      [gwPayment("order_orphan", "captured", 5000)],
    );
    expect(report.discrepancies[0]?.kind).toBe("MISSING_LOCALLY");
  });
});
