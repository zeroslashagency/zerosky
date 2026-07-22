// @zerosky/auth — multi-tenant authentication context

import { AuthorizationError, assertMinRole } from "./rbac.js";
import type { AuthUser, Role } from "./types.js";

export class TenantMismatchError extends Error {
  constructor(message = "tenant mismatch") {
    super(message);
    this.name = "TenantMismatchError";
  }
}

/**
 * Immutable per-request auth context. Wraps the authenticated user and enforces
 * that all access stays within the user's tenant.
 */
export class AuthContext {
  constructor(readonly user: AuthUser) {}

  get userId(): string {
    return this.user.id;
  }

  get tenantId(): string {
    return this.user.tenantId;
  }

  get role(): Role {
    return this.user.role;
  }

  /** Throw unless the given tenantId matches this context's tenant. */
  assertTenant(tenantId: string): void {
    if (tenantId !== this.user.tenantId) {
      throw new TenantMismatchError(
        `resource tenant ${tenantId} does not match context tenant ${this.user.tenantId}`,
      );
    }
  }

  assertMinRole(min: Role): void {
    assertMinRole(this.user.role, min);
  }

  isOwner(): boolean {
    return this.user.role === "OWNER";
  }
}

export { AuthorizationError };
