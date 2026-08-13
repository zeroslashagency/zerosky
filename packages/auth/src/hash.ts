// @zerosky/auth — password + generic secret hashing (bcrypt)

import { createHash } from "node:crypto";
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

/**
 * bcrypt silently ignores everything past the first 72 bytes of its input.
 * A JWT is far longer than that and two tokens for the same session differ only
 * in their trailing claims, so hashing them directly made distinct tokens
 * compare as equal — which quietly disabled refresh-token reuse detection.
 * Folding the secret through sha256 first gives bcrypt a fixed-length input
 * that depends on every byte.
 */
function digest(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("base64");
}

/** Hash an arbitrary long secret (e.g. a refresh token). */
export async function hashSecret(
  secret: string,
  rounds: number = DEFAULT_ROUNDS,
): Promise<string> {
  return bcrypt.hash(digest(secret), rounds);
}

export async function verifySecret(
  secret: string,
  hash: string,
): Promise<boolean> {
  if (!secret || !hash) return false;
  return bcrypt.compare(digest(secret), hash);
}
