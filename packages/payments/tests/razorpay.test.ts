import { describe, expect, it, vi } from "vitest";
import { RazorpayGateway } from "../src/razorpay.js";
import { createMockRazorpay } from "./helpers.js";

describe("RazorpayGateway", () => {
  it("creates an order converting rupees to paise", async () => {
    const client = createMockRazorpay({ orderId: "order_abc" });
    const createSpy = vi.spyOn(client.orders, "create");
    const gateway = new RazorpayGateway(client);

    const order = await gateway.createOrder({
      amountRupees: 250.5,
      receipt: "r1",
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 25050, currency: "INR", receipt: "r1" }),
    );
    expect(order.id).toBe("order_abc");
    expect(order.amount).toBe(25050);
  });

  it("normalises string amounts from the SDK", async () => {
    const client = createMockRazorpay();
    client.orders.create = async () => ({
      id: "order_str",
      amount: "5000",
      currency: "INR",
      status: "created",
    });
    const gateway = new RazorpayGateway(client);
    const order = await gateway.createOrder({ amountRupees: 50 });
    expect(order.amount).toBe(5000);
  });

  it("fetches and normalises a payment", async () => {
    const gateway = new RazorpayGateway(
      createMockRazorpay({ paymentStatus: "captured", paymentAmountPaise: 7500 }),
    );
    const payment = await gateway.fetchPayment("pay_1");
    expect(payment.captured).toBe(true);
    expect(payment.amount).toBe(7500);
    expect(payment.status).toBe("captured");
  });

  it("captures a payment", async () => {
    const client = createMockRazorpay();
    const captureSpy = vi.spyOn(client.payments, "capture");
    const gateway = new RazorpayGateway(client);
    const payment = await gateway.capturePayment("pay_1", 100);
    expect(captureSpy).toHaveBeenCalledWith("pay_1", 10000, "INR");
    expect(payment.captured).toBe(true);
  });

  it("creates a full refund (no amount)", async () => {
    const client = createMockRazorpay();
    const refundSpy = vi.spyOn(client.payments, "refund");
    const gateway = new RazorpayGateway(client);
    const refund = await gateway.createRefund("pay_1");
    expect(refundSpy).toHaveBeenCalledWith("pay_1", {
      amount: undefined,
      notes: undefined,
    });
    expect(refund.paymentId).toBe("pay_1");
  });

  it("creates a partial refund converting amount", async () => {
    const client = createMockRazorpay();
    const refundSpy = vi.spyOn(client.payments, "refund");
    const gateway = new RazorpayGateway(client);
    await gateway.createRefund("pay_1", 40, { reason: "partial" });
    expect(refundSpy).toHaveBeenCalledWith("pay_1", {
      amount: 4000,
      notes: { reason: "partial" },
    });
  });

  it("fetches a refund", async () => {
    const gateway = new RazorpayGateway(
      createMockRazorpay({ refundStatus: "processed" }),
    );
    const refund = await gateway.fetchRefund("rfnd_1");
    expect(refund.id).toBe("rfnd_1");
    expect(refund.status).toBe("processed");
  });
});
