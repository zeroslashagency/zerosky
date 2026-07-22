import { describe, expect, it } from "vitest";
import {
  InvalidAmountError,
  rupeesEqual,
  sumRupees,
  toPaise,
  toRupees,
} from "../src/money.js";
import {
  canTransition,
  fromRazorpayStatus,
  InvalidTransitionError,
  isTerminal,
  nextStates,
  transition,
} from "../src/state.js";

describe("money", () => {
  it("converts rupees to paise with rounding", () => {
    expect(toPaise(100)).toBe(10000);
    expect(toPaise(99.99)).toBe(9999);
    expect(toPaise(0.1)).toBe(10);
  });

  it("round-trips rupees through paise without float drift", () => {
    expect(sumRupees([0.1, 0.2])).toBe(0.3);
    expect(toRupees(10000)).toBe(100);
  });

  it("rejects invalid amounts", () => {
    expect(() => toPaise(Number.NaN)).toThrow(InvalidAmountError);
    expect(() => toPaise(-1)).toThrow(InvalidAmountError);
    expect(() => toPaise(Infinity)).toThrow(InvalidAmountError);
    expect(() => toRupees(1.5)).toThrow(InvalidAmountError);
  });

  it("compares rupees to the paise", () => {
    expect(rupeesEqual(50, 50.0)).toBe(true);
    expect(rupeesEqual(50, 50.01)).toBe(false);
  });
});

describe("state machine", () => {
  it("allows legal transitions", () => {
    expect(canTransition("PENDING", "CAPTURED")).toBe(true);
    expect(canTransition("PENDING", "FAILED")).toBe(true);
    expect(canTransition("CAPTURED", "REFUNDED")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("PENDING", "REFUNDED")).toBe(false);
    expect(canTransition("FAILED", "CAPTURED")).toBe(false);
    expect(canTransition("REFUNDED", "CAPTURED")).toBe(false);
  });

  it("transition() returns target or throws", () => {
    expect(transition("PENDING", "CAPTURED")).toBe("CAPTURED");
    expect(() => transition("PENDING", "REFUNDED")).toThrow(
      InvalidTransitionError,
    );
  });

  it("identifies terminal states", () => {
    expect(isTerminal("FAILED")).toBe(true);
    expect(isTerminal("REFUNDED")).toBe(true);
    expect(isTerminal("PENDING")).toBe(false);
    expect(isTerminal("CAPTURED")).toBe(false);
  });

  it("lists next states", () => {
    expect(nextStates("PENDING")).toEqual(["CAPTURED", "FAILED"]);
    expect(nextStates("FAILED")).toEqual([]);
  });

  it("maps razorpay statuses", () => {
    expect(fromRazorpayStatus("captured")).toBe("CAPTURED");
    expect(fromRazorpayStatus("failed")).toBe("FAILED");
    expect(fromRazorpayStatus("refunded")).toBe("REFUNDED");
    expect(fromRazorpayStatus("created")).toBe("PENDING");
    expect(fromRazorpayStatus("authorized")).toBe("PENDING");
    expect(fromRazorpayStatus("weird")).toBe("PENDING");
  });

  it("exposes error metadata", () => {
    const err = new InvalidTransitionError("FAILED", "CAPTURED");
    expect(err.from).toBe("FAILED");
    expect(err.to).toBe("CAPTURED");
    expect(err.name).toBe("InvalidTransitionError");
  });
});
