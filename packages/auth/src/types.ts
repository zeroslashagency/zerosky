// @zerosky/auth — shared types

export type Role = "OWNER" | "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN";

export type TokenType = "access" | "refresh";

export interface TokenPayload {
  sub: string; // user id
  tenantId: string;
  role: Role;
  type: TokenType;
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  role: Role;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number; // default 900 (15m)
  refreshTtlSeconds: number; // default 604800 (7d)
  issuer?: string;
}

export interface SessionRecord {
  userId: string;
  tenantId: string;
  role: Role;
  // Hash of the currently-valid refresh token. Rotated on every refresh.
  refreshTokenHash: string;
  createdAt: number;
  updatedAt: number;
}
