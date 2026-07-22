// @zerosky/auth — Redis-backed session management with refresh-token rotation

import type Redis from "ioredis";
import { hashSecret, verifySecret } from "./hash.js";
import type { Role, SessionRecord } from "./types.js";

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

export interface CreateSessionInput {
  sessionId: string;
  userId: string;
  tenantId: string;
  role: Role;
  refreshToken: string;
}

const PREFIX = "session:";

export class SessionManager {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number = 604800,
  ) {}

  private key(sessionId: string): string {
    return `${PREFIX}${sessionId}`;
  }

  async create(input: CreateSessionInput): Promise<void> {
    const now = Date.now();
    const record: SessionRecord = {
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      refreshTokenHash: await hashSecret(input.refreshToken),
      createdAt: now,
      updatedAt: now,
    };
    await this.redis.set(
      this.key(input.sessionId),
      JSON.stringify(record),
      "EX",
      this.ttlSeconds,
    );
  }

  async get(sessionId: string): Promise<SessionRecord | null> {
    const raw = await this.redis.get(this.key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as SessionRecord;
  }

  /**
   * Validate a presented refresh token against the stored session and rotate it.
   * If the presented token does not match the currently-stored hash, this is a
   * reuse/replay of a stale token: the entire session is revoked and an error thrown.
   */
  async rotate(
    sessionId: string,
    presentedRefreshToken: string,
    newRefreshToken: string,
  ): Promise<SessionRecord> {
    const record = await this.get(sessionId);
    if (!record) {
      throw new SessionError("session not found or expired");
    }

    const matches = await verifySecret(
      presentedRefreshToken,
      record.refreshTokenHash,
    );
    if (!matches) {
      // Stale/leaked token replay — revoke the whole session defensively.
      await this.revoke(sessionId);
      throw new SessionError("refresh token reuse detected; session revoked");
    }

    const updated: SessionRecord = {
      ...record,
      refreshTokenHash: await hashSecret(newRefreshToken),
      updatedAt: Date.now(),
    };
    await this.redis.set(
      this.key(sessionId),
      JSON.stringify(updated),
      "EX",
      this.ttlSeconds,
    );
    return updated;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }

  async exists(sessionId: string): Promise<boolean> {
    return (await this.redis.exists(this.key(sessionId))) === 1;
  }
}
