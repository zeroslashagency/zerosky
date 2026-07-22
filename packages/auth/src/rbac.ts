// @zerosky/auth — role-based access control

import type { Role } from "./types.js";

// Higher number = more privilege.
const RANK: Record<Role, number> = {
  KITCHEN: 1,
  WAITER: 2,
  CASHIER: 3,
  MANAGER: 4,
  OWNER: 5,
};

export class AuthorizationError extends Error {
  constructor(message = "insufficient privileges") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function roleRank(role: Role): number {
  return RANK[role];
}

/** True if `role` meets or exceeds `min` in the hierarchy. */
export function hasMinRole(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/** True if `role` is exactly one of `allowed`. */
export function hasExactRole(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role);
}

export function assertMinRole(role: Role, min: Role): void {
  if (!hasMinRole(role, min)) {
    throw new AuthorizationError(
      `role ${role} does not meet minimum ${min}`,
    );
  }
}

export function assertExactRole(role: Role, allowed: readonly Role[]): void {
  if (!hasExactRole(role, allowed)) {
    throw new AuthorizationError(
      `role ${role} is not in [${allowed.join(", ")}]`,
    );
  }
}
