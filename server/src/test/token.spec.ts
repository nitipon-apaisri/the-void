import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { createTokenService } from "../services/token.service.js";

const secret = "s".repeat(32);

describe("token service", () => {
  it("round-trips a user id and version", async () => {
    const tokens = createTokenService(secret);
    expect(await tokens.verify(await tokens.issue("user-1", 3))).toEqual({
      userId: "user-1",
      version: 3,
    });
  });

  it("rejects a token that has no version", async () => {
    const old = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("the-void")
      .setAudience("the-void-client")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(secret));
    expect(await createTokenService(secret).verify(old)).toBeUndefined();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await createTokenService("x".repeat(32)).issue("user-1", 0);
    expect(await createTokenService(secret).verify(token)).toBeUndefined();
  });

  it("rejects an expired token", async () => {
    const token = await createTokenService(secret, "-1s").issue("user-1", 0);
    expect(await createTokenService(secret).verify(token)).toBeUndefined();
  });

  it("rejects a token without our issuer and audience", async () => {
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(secret));
    expect(await createTokenService(secret).verify(forged)).toBeUndefined();
  });

  it.each([undefined, null, 5, "", "not.a.jwt"])("rejects %j", async (value) => {
    expect(await createTokenService(secret).verify(value)).toBeUndefined();
  });
});
