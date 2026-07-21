// @zerosky/auth — PIN-based quick login (4-6 digits)

import bcrypt from "bcryptjs";

const PIN_ROUNDS = 10;
const PIN_RE = /^\d{4,6}$/;

export function isValidPin(pin: string): boolean {
  return PIN_RE.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be 4-6 digits");
  }
  return bcrypt.hash(pin, PIN_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!isValidPin(pin) || !hash) return false;
  return bcrypt.compare(pin, hash);
}
