// @zerosky/auth — JWT access + refresh token issuance/verification

import jwt from "jsonwebtoken";
import { z } from "zod";
import type { JwtConfig, Role, TokenPair, TokenPayload, TokenType } from "./types.js";

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

const ROLES = ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN"] as const;

const payloadSchema = z.object({
  sub: z.string().min(1),
  tenantId: z.string().min(1),
  role: z.enum(ROLES),
  type: z.enum(["access", "refresh"]),
  sessionId: z.string().min(1),
});

export const DEFAULT_ACCESS_TTL = 900; // 15 minutes
export const DEFAULT_REFRESH_TTL = 604800; // 7 days

export interface IssueInput {
  userId: string;
  tenantId: string;
  role: Role;
  sessionId: string;
}

export class JwtService {
  constructor(private readonly config: JwtConfig) {
    if (!config.accessSecret || !config.refreshSecret) {
      throw new Error("JwtService requires access and refresh secrets");
    }
    if (config.accessSecret === config.refreshSecret) {
      throw new Error("access and refresh secrets must differ");
    }
  }

  private secretFor(type: TokenType): string {
    return type === "access"
      ? this.config.accessSecret
      : this.config.refreshSecret;
  }

  private ttlFor(type: TokenType): number {
    return type === "access"
      ? this.config.accessTtlSeconds
      : this.config.refreshTtlSeconds;
  }

  private sign(type: TokenType, input: IssueInput): string {
    const payload: TokenPayload = {
      sub: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      type,
      sessionId: input.sessionId,
    };
    const opts: jwt.SignOptions = { expiresIn: this.ttlFor(type) };
    if (this.config.issuer) opts.issuer = this.config.issuer;
    return jwt.sign(payload, this.secretFor(type), opts);
  }

  issueTokens(input: IssueInput): TokenPair {
    return {
      accessToken: this.sign("access", input),
      refreshToken: this.sign("refresh", input),
    };
  }

  /** Verify a token, checking signature, expiry, and that the embedded type matches. */
  verify(token: string, expected: TokenType): TokenPayload {
    let decoded: unknown;
    try {
      const opts: jwt.VerifyOptions = {};
      if (this.config.issuer) opts.issuer = this.config.issuer;
      decoded = jwt.verify(token, this.secretFor(expected), opts);
    } catch (err) {
      throw new TokenError(
        err instanceof Error ? err.message : "token verification failed",
      );
    }

    const parsed = payloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new TokenError("token payload is malformed");
    }
    if (parsed.data.type !== expected) {
      // Guard against using a refresh token where an access token is required, etc.
      throw new TokenError(
        `token type mismatch: expected ${expected}, got ${parsed.data.type}`,
      );
    }
    return parsed.data;
  }
}
