// @zerosky/auth — password + generic secret hashing (bcrypt)

import bcrypt from "bcryptjs";

const DEFAULT_ROUNDS = 12;

export async function hashPassword(
  plain: string,
  rounds: number = DEFAULT_ROUNDS,
): Promise<string> {
  if (!plain) throw new Error("password must not be empty");
  return bcrypt.hash(plain, rounds);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

/** Hash an arbitrary secret string (e.g. a refresh token) with sha256-like bcrypt. */
export async function hashSecret(
  secret: string,
  rounds: number = DEFAULT_ROUNDS,
): Promise<string> {
  return bcrypt.hash(secret, rounds);
}

export async function verifySecret(
  secret: string,
  hash: string,
): Promise<boolean> {
  if (!secret || !hash) return false;
  return bcrypt.compare(secret, hash);
}
