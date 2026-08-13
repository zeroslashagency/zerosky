import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
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

  it("enforces the type claim independently of the secret", () => {
    // The previous test passes for the wrong reason: access and refresh use
    // different secrets, so the signature fails before `type` is inspected.
    // Signing a refresh-typed token with the ACCESS secret isolates the claim
    // check, so removing it cannot go unnoticed.
    const svc = new JwtService(config);
    const smuggled = jwt.sign(
      {
        sub: "user_1",
        tenantId: "tenant_1",
        role: "MANAGER",
        type: "refresh",
        sessionId: "sess_1",
      },
      config.accessSecret,
      { expiresIn: 900, issuer: config.issuer },
    );

    expect(() => svc.verify(smuggled, "access")).toThrow(/type mismatch/);
  });

  it("rejects an expired token", () => {
    const svc = new JwtService({ ...config, accessTtlSeconds: -10 });
    const { accessToken } = svc.issueTokens(input);
    expect(() => svc.verify(accessToken, "access")).toThrow(TokenError);
  });

  it("gives each issued token a unique id so rotation produces a new string", () => {
    const svc = new JwtService(config);
    const first = svc.issueTokens(input);
    const second = svc.issueTokens(input);
    // Without a jti, two tokens minted in the same second are byte-identical,
    // which silently defeats refresh-token reuse detection.
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).not.toBe(first.accessToken);
  });

  it("works without an issuer configured", () => {
    const svc = new JwtService({ ...config, issuer: undefined });
    const { accessToken } = svc.issueTokens(input);
    expect(svc.verify(accessToken, "access").sub).toBe("user_1");
  });
});
