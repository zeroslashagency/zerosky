import { describe, expect, it } from "vitest";
import { hashPassword, hashSecret, verifyPassword, verifySecret } from "../src/hash.js";
import { hashPin, isValidPin, verifyPin } from "../src/pin.js";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("s3cret!", 4);
    expect(hash).not.toBe("s3cret!");
    expect(await verifyPassword("s3cret!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("rejects empty password on hash", async () => {
    await expect(hashPassword("")).rejects.toThrow();
  });

  it("verifyPassword returns false on empty inputs", async () => {
    expect(await verifyPassword("", "x")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });

  it("hashes and verifies a generic secret", async () => {
    const hash = await hashSecret("refresh-token-abc", 4);
    expect(await verifySecret("refresh-token-abc", hash)).toBe(true);
    expect(await verifySecret("other", hash)).toBe(false);
    expect(await verifySecret("", hash)).toBe(false);
  });
});

describe("pin hashing", () => {
  it("validates 4-6 digit pins", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("abcd")).toBe(false);
  });

  it("hashes and verifies a pin", async () => {
    const hash = await hashPin("4321");
    expect(await verifyPin("4321", hash)).toBe(true);
    expect(await verifyPin("0000", hash)).toBe(false);
  });

  it("rejects invalid pin on hash", async () => {
    await expect(hashPin("12")).rejects.toThrow();
  });

  it("verifyPin returns false for invalid pin format", async () => {
    expect(await verifyPin("ab", "hash")).toBe(false);
  });
});
