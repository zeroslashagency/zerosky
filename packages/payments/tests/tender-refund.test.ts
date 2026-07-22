import { describe, expect, it } from "vitest";
import {
  settleSplitPayment,
  splitEvenly,
  SplitMismatchError,
  validateSplit,
} from "../src/multi-tender.js";
import { RazorpayGateway } from "../src/razorpay.js";
import {
  refundPayment,
  RefundAmountError,
  isFullRefund,
} from "../src/refund.js";
import { InvalidTransitionError } from "../src/state.js";
import { InMemoryPaymentRepository, createMockRazorpay } from "./helpers.js";

describe("multi-tender", () => {
  it("validates a matching split", () => {
    expect(
      validateSplit(100, [
        { method: "CASH", amount: 50 },
        { method: "UPI", amount: 50 },
      ]),
    ).toBe(100);
  });

  it("rejects an empty split", () => {
    expect(() => validateSplit(100, [])).toThrow(SplitMismatchError);
  });

  it("rejects a non-positive tender", () => {
    expect(() =>
      validateSplit(100, [
        { method: "CASH", amount: 0 },
        { method: "UPI", amount: 100 },
      ]),
    ).toThrow(SplitMismatchError);
  });

  it("rejects a mismatched split", () => {
    expect(() =>
      validateSplit(100, [
        { method: "CASH", amount: 50 },
        { method: "UPI", amount: 40 },
      ]),
    ).toThrow(SplitMismatchError);
  });

  it("splits evenly assigning remainder to the first tender", () => {
    const tenders = splitEvenly(100, ["CASH", "UPI", "CARD"]);
    expect(tenders).toHaveLength(3);
    const total = tenders.reduce((a, t) => a + t.amount, 0);
    expect(total).toBeCloseTo(100, 2);
    // 10000 paise / 3 = 3333 base, remainder 1 paise → first gets 33.34
    expect(tenders[0]?.amount).toBe(33.34);
    expect(tenders[1]?.amount).toBe(33.33);
  });

  it("throws when splitting across zero methods", () => {
    expect(() => splitEvenly(100, [])).toThrow(SplitMismatchError);
  });

  it("settles a 50% cash + 50% UPI split with correct statuses", async () => {
    const repo = new InMemoryPaymentRepository();
    const records = await settleSplitPayment(repo, {
      branchId: "b1",
      orderId: "o1",
      grandTotal: 100,
      tenders: [
        { method: "CASH", amount: 50 },
        { method: "UPI", amount: 50, reference: "order_upi" },
      ],
    });

    expect(records).toHaveLength(2);
    const cash = records.find((r) => r.method === "CASH");
    const upi = records.find((r) => r.method === "UPI");
    expect(cash?.status).toBe("CAPTURED");
    expect(upi?.status).toBe("PENDING");
    expect(repo.size()).toBe(2);
  });

  it("refuses to settle a mismatched split", async () => {
    const repo = new InMemoryPaymentRepository();
    await expect(
      settleSplitPayment(repo, {
        branchId: "b1",
        orderId: "o1",
        grandTotal: 100,
        tenders: [{ method: "CASH", amount: 40 }],
      }),
    ).rejects.toThrow(SplitMismatchError);
    expect(repo.size()).toBe(0);
  });
});

describe("refunds", () => {
  it("refunds a captured payment fully", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(createMockRazorpay());
    const captured = await repo.create({
      branchId: "b1",
      orderId: "o1",
      method: "CARD",
      amount: 100,
      status: "CAPTURED",
      reference: "order_1",
    });

    const result = await refundPayment(gateway, repo, {
      localPaymentId: captured.id,
      razorpayPaymentId: "pay_gw",
    });

    expect(result.payment.status).toBe("REFUNDED");
    expect(result.refund.paymentId).toBe("pay_gw");
  });

  it("allows a valid partial refund", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(createMockRazorpay());
    const captured = await repo.create({
      branchId: "b1",
      orderId: "o1",
      method: "CARD",
      amount: 100,
      status: "CAPTURED",
    });
    const result = await refundPayment(gateway, repo, {
      localPaymentId: captured.id,
      razorpayPaymentId: "pay_gw",
      amountRupees: 40,
    });
    expect(result.payment.status).toBe("REFUNDED");
  });

  it("rejects refunding a pending payment", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(createMockRazorpay());
    const pending = await repo.create({
      branchId: "b1",
      orderId: "o1",
      method: "CARD",
      amount: 100,
      status: "PENDING",
    });
    await expect(
      refundPayment(gateway, repo, {
        localPaymentId: pending.id,
        razorpayPaymentId: "pay_gw",
      }),
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects an over-refund", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(createMockRazorpay());
    const captured = await repo.create({
      branchId: "b1",
      orderId: "o1",
      method: "CARD",
      amount: 100,
      status: "CAPTURED",
    });
    await expect(
      refundPayment(gateway, repo, {
        localPaymentId: captured.id,
        razorpayPaymentId: "pay_gw",
        amountRupees: 150,
      }),
    ).rejects.toThrow(RefundAmountError);
  });

  it("rejects a non-positive partial refund", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(createMockRazorpay());
    const captured = await repo.create({
      branchId: "b1",
      orderId: "o1",
      method: "CARD",
      amount: 100,
      status: "CAPTURED",
    });
    await expect(
      refundPayment(gateway, repo, {
        localPaymentId: captured.id,
        razorpayPaymentId: "pay_gw",
        amountRupees: 0,
      }),
    ).rejects.toThrow(RefundAmountError);
  });

  it("throws when refunding a missing payment", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(createMockRazorpay());
    await expect(
      refundPayment(gateway, repo, {
        localPaymentId: "nope",
        razorpayPaymentId: "pay_gw",
      }),
    ).rejects.toThrow(/Payment not found/);
  });

  it("classifies full vs partial refunds", () => {
    expect(isFullRefund(100)).toBe(true);
    expect(isFullRefund(100, 100)).toBe(true);
    expect(isFullRefund(100, 40)).toBe(false);
  });
});
