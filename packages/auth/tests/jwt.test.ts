import { describe, expect, it } from "vitest";
import { JwtService, TokenError } from "../src/jwt.js";
import type { IssueInput } from "../src/jwt.js";

const config = {
  accessSecret: "access-secret-aaa",
  refreshSecret: "refresh-secret-bbb",
  accessTtlSeconds: 900,
  refreshTtlSeconds: 604800,
  issuer: "zerosky",
};

const input: IssueInput = {
  userId: "user_1",
  tenantId: "tenant_1",
  role: "MANAGER",
  sessionId: "sess_1",
};

describe("JwtService", () => {
  it("rejects missing or identical secrets", () => {
    expect(() => new JwtService({ ...config, accessSecret: "" })).toThrow();
    expect(
      () => new JwtService({ ...config, refreshSecret: config.accessSecret }),
    ).toThrow();
  });

  it("issues and verifies an access token", () => {
    const svc = new JwtService(config);
    const { accessToken } = svc.issueTokens(input);
    const payload = svc.verify(accessToken, "access");
    expect(payload.sub).toBe("user_1");
    expect(payload.tenantId).toBe("tenant_1");
    expect(payload.role).toBe("MANAGER");
    expect(payload.type).toBe("access");
  });

  it("verifies a refresh token", () => {
    const svc = new JwtService(config);
    const { refreshToken } = svc.issueTokens(input);
    const payload = svc.verify(refreshToken, "refresh");
    expect(payload.type).toBe("refresh");
  });

  it("rejects using a refresh token as an access token (type/secret mismatch)", () => {
    const svc = new JwtService(config);
    const { refreshToken } = svc.issueTokens(input);
    expect(() => svc.verify(refreshToken, "access")).toThrow(TokenError);
  });

  it("rejects a tampered/invalid token", () => {
    const svc = new JwtService(config);
    expect(() => svc.verify("not.a.jwt", "access")).toThrow(TokenError);
  });

  it("works without an issuer configured", () => {
    const svc = new JwtService({ ...config, issuer: undefined });
    const { accessToken } = svc.issueTokens(input);
    expect(svc.verify(accessToken, "access").sub).toBe("user_1");
  });
});
