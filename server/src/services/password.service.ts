// node
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// OWASP's scrypt floor (N=2^17, r=8, p=1) is ~128 MiB per hash; that is too heavy for a
// small VPS under a login burst, so use N=2^15 (~32 MiB) and rely on the rate limiter.
const PARAMS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } satisfies ScryptOptions;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const derive = (password: string, salt: Buffer, params: ScryptOptions, length: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, length, params, (err, key) => (err ? reject(err) : resolve(key))),
  );

export interface PasswordService {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}

export function createPasswordService(): PasswordService {
  return {
    // Stored as `scrypt$N$r$p$salt$key` so parameters can change without breaking old hashes.
    async hash(password) {
      const salt = randomBytes(SALT_LENGTH);
      const key = await derive(password, salt, PARAMS, KEY_LENGTH);
      return [
        "scrypt",
        PARAMS.N,
        PARAMS.r,
        PARAMS.p,
        salt.toString("base64"),
        key.toString("base64"),
      ].join("$");
    },

    async verify(password, stored) {
      const [scheme, n, r, p, salt, key] = stored.split("$");
      if (scheme !== "scrypt" || !salt || !key) return false;
      const expected = Buffer.from(key, "base64");
      const actual = await derive(
        password,
        Buffer.from(salt, "base64"),
        { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem },
        expected.length,
      );
      return timingSafeEqual(actual, expected);
    },
  };
}
