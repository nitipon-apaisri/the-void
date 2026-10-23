// lib
import { SignJWT, jwtVerify } from "jose";

const ISSUER = "the-void";
const AUDIENCE = "the-void-client";

export interface TokenClaims {
  userId: string;
  version: number;
}

export interface TokenService {
  /** `version` is the account's token version; bumping it later invalidates this token. */
  issue(userId: string, version: number): Promise<string>;
  /** The claims, or undefined for anything expired, forged or malformed. */
  verify(token: unknown): Promise<TokenClaims | undefined>;
}

export function createTokenService(secret: string, ttl = "7d"): TokenService {
  const key = new TextEncoder().encode(secret);
  return {
    issue: (userId, version) =>
      new SignJWT({ tv: version })
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
        const { sub, tv } = payload;
        return typeof sub === "string" && Number.isInteger(tv)
          ? { userId: sub, version: tv as number }
          : undefined;
      } catch {
        return undefined;
      }
    },
  };
}
