import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { RazorpayGateway } from "../src/razorpay.js";
import { startUpiPayment, confirmUpiPayment } from "../src/upi.js";
import {
  startCardPayment,
  confirmCardPayment,
  verifyCheckoutSignature,
  SignatureVerificationError,
} from "../src/card.js";
import { InvalidTransitionError } from "../src/state.js";
import { InMemoryPaymentRepository, createMockRazorpay } from "./helpers.js";

function checkoutSignature(orderId: string, paymentId: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

describe("UPI flow", () => {
  it("starts a UPI payment and records PENDING", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(createMockRazorpay({ orderId: "order_upi" }));

    const result = await startUpiPayment(gateway, repo, {
      branchId: "b1",
      orderId: "o1",
      amountRupees: 100,
      vpa: "user@bank",
    });

    expect(result.order.id).toBe("order_upi");
    const stored = await repo.findById(result.paymentId);
    expect(stored?.status).toBe("PENDING");
    expect(stored?.method).toBe("UPI");
    expect(stored?.reference).toBe("order_upi");
  });

  it("confirms a UPI payment to CAPTURED", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(
      createMockRazorpay({ orderId: "order_upi", paymentStatus: "captured" }),
    );
    const { paymentId } = await startUpiPayment(gateway, repo, {
      branchId: "b1",
      orderId: "o1",
      amountRupees: 100,
    });

    const confirmed = await confirmUpiPayment(gateway, repo, paymentId, "pay_gw");
    expect(confirmed.status).toBe("CAPTURED");
    expect(confirmed.reference).toBe("pay_gw");
  });

  it("throws when confirming a missing payment", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(createMockRazorpay());
    await expect(
      confirmUpiPayment(gateway, repo, "nope", "pay_gw"),
    ).rejects.toThrow(/Payment not found/);
  });

  it("rejects an illegal confirm transition", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(
      createMockRazorpay({ paymentStatus: "created" }),
    );
    const { paymentId } = await startUpiPayment(gateway, repo, {
      branchId: "b1",
      orderId: "o1",
      amountRupees: 100,
    });
    // gateway status "created" → PENDING, PENDING→PENDING is illegal
    await expect(
      confirmUpiPayment(gateway, repo, paymentId, "pay_gw"),
    ).rejects.toThrow(InvalidTransitionError);
  });
});

describe("card flow", () => {
  const secret = "test_secret";

  it("starts a card payment producing checkout options", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(createMockRazorpay({ orderId: "order_card" }));

    const result = await startCardPayment(gateway, repo, "rzp_key", {
      branchId: "b1",
      orderId: "o1",
      amountRupees: 100,
    });

    expect(result.checkout.order_id).toBe("order_card");
    expect(result.checkout.amount).toBe(10000);
    expect(result.checkout.key).toBe("rzp_key");
    const stored = await repo.findById(result.paymentId);
    expect(stored?.method).toBe("CARD");
  });

  it("verifies a valid checkout signature", () => {
    const sig = checkoutSignature("order_1", "pay_1", secret);
    expect(
      verifyCheckoutSignature(
        {
          razorpay_order_id: "order_1",
          razorpay_payment_id: "pay_1",
          razorpay_signature: sig,
        },
        secret,
      ),
    ).toBe(true);
  });

  it("rejects a tampered checkout signature", () => {
    expect(
      verifyCheckoutSignature(
        {
          razorpay_order_id: "order_1",
          razorpay_payment_id: "pay_1",
          razorpay_signature: "deadbeef",
        },
        secret,
      ),
    ).toBe(false);
  });

  it("confirms a card payment with a valid signature", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(
      createMockRazorpay({ orderId: "order_card", paymentStatus: "captured" }),
    );
    const { paymentId } = await startCardPayment(gateway, repo, "rzp_key", {
      branchId: "b1",
      orderId: "o1",
      amountRupees: 100,
    });

    const sig = checkoutSignature("order_card", "pay_gw", secret);
    const confirmed = await confirmCardPayment(gateway, repo, secret, paymentId, {
      razorpay_order_id: "order_card",
      razorpay_payment_id: "pay_gw",
      razorpay_signature: sig,
    });
    expect(confirmed.status).toBe("CAPTURED");
  });

  it("refuses to confirm a card payment with a bad signature", async () => {
    const repo = new InMemoryPaymentRepository();
    const gateway = new RazorpayGateway(createMockRazorpay());
    const { paymentId } = await startCardPayment(gateway, repo, "rzp_key", {
      branchId: "b1",
      orderId: "o1",
      amountRupees: 100,
    });
    await expect(
      confirmCardPayment(gateway, repo, secret, paymentId, {
        razorpay_order_id: "order_card",
        razorpay_payment_id: "pay_gw",
        razorpay_signature: "00",
      }),
    ).rejects.toThrow(SignatureVerificationError);
  });
});
