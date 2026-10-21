// shared
import {
  AVATAR_COLORS,
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type LoginPayload,
  type RegisterPayload,
} from "@void/shared";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

// Deliberately loose: the only real proof an address works is mailing it.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function normalizeEmail(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const email = raw.trim().toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL.test(email) ? email : undefined;
}

export function parseLogin(body: unknown): Parsed<LoginPayload> {
  if (!isObject(body)) return fail("invalid request");
  const email = normalizeEmail(body.email);
  // No length floor here: a login should not reveal the password policy, only reject abuse.
  if (!email || typeof body.password !== "string" || body.password.length > MAX_PASSWORD_LENGTH) {
    return fail("invalid email or password");
  }
  return { ok: true, value: { email, password: body.password } };
}

export function parseRegistration(body: unknown): Parsed<RegisterPayload> {
  if (!isObject(body)) return fail("invalid request");
  const email = normalizeEmail(body.email);
  if (!email) return fail("enter a valid email address");

  const { password } = body;
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return fail(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return fail(`password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    return fail(`name must be 1 to ${MAX_NAME_LENGTH} characters`);
  }

  const { avatar } = body;
  if (
    !Number.isInteger(avatar) ||
    (avatar as number) < 0 ||
    (avatar as number) >= AVATAR_COLORS.length
  ) {
    return fail("pick an avatar colour");
  }

  return { ok: true, value: { email, password, name, avatar: avatar as number } };
}
