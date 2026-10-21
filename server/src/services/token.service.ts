// lib
import { SignJWT, jwtVerify } from "jose";

const ISSUER = "the-void";
const AUDIENCE = "the-void-client";

export interface TokenService {
  issue(userId: string): Promise<string>;
  /** The user id, or undefined for anything expired, forged or malformed. */
  verify(token: unknown): Promise<string | undefined>;
}

export function createTokenService(secret: string, ttl = "7d"): TokenService {
  const key = new TextEncoder().encode(secret);
  return {
    issue: (userId) =>
      new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(ttl)
        .sign(key),

    async verify(token) {
      if (typeof token !== "string") return undefined;
      try {
        const { payload } = await jwtVerify(token, key, {
          issuer: ISSUER,
          audience: AUDIENCE,
          algorithms: ["HS256"],
        });
        return payload.sub;
      } catch {
        return undefined;
      }
    },
  };
}
