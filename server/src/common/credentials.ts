// shared
import {
  isLook,
  MAX_EMAIL_LENGTH,
  MAX_INVITE_HOURS,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_SPACE_NAME_LENGTH,
  isSpaceSize,
  isSpaceTemplate,
  MIN_PASSWORD_LENGTH,
  type ChangeEmailPayload,
  type ChangePasswordPayload,
  type CreateSpacePayload,
  type DeleteAccountPayload,
  type InviteOptions,
  type LoginPayload,
  type RegisterPayload,
  type UpdateProfilePayload,
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

const checkNewPassword = (password: unknown): string | undefined => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  }
  return undefined;
};

const parseName = (raw: unknown): string | undefined => {
  const name = typeof raw === "string" ? raw.trim() : "";
  return name && name.length <= MAX_NAME_LENGTH ? name : undefined;
};

// A current password is only checked for presence and size here; the service verifies it.
const parseCurrentPassword = (raw: unknown): string | undefined =>
  typeof raw === "string" && raw.length > 0 && raw.length <= MAX_PASSWORD_LENGTH ? raw : undefined;

export function parseRegistration(body: unknown): Parsed<RegisterPayload> {
  if (!isObject(body)) return fail("invalid request");
  const email = normalizeEmail(body.email);
  if (!email) return fail("enter a valid email address");

  const passwordError = checkNewPassword(body.password);
  if (passwordError) return fail(passwordError);

  const profile = parseProfile(body);
  if (!profile.ok) return profile;

  return { ok: true, value: { email, password: body.password as string, ...profile.value } };
}

export function parseProfile(body: unknown): Parsed<UpdateProfilePayload> {
  if (!isObject(body)) return fail("invalid request");
  const name = parseName(body.name);
  if (!name) return fail(`name must be 1 to ${MAX_NAME_LENGTH} characters`);
  if (!isLook(body.look)) return fail("pick a character");
  // Copy the known fields so nothing else a client sent is stored or echoed back.
  const { body: bodyPart, eyes, outfit, hair, accessory } = body.look;
  return { ok: true, value: { name, look: { body: bodyPart, eyes, outfit, hair, accessory } } };
}

export function parsePasswordChange(body: unknown): Parsed<ChangePasswordPayload> {
  if (!isObject(body)) return fail("invalid request");
  const currentPassword = parseCurrentPassword(body.currentPassword);
  if (!currentPassword) return fail("enter your current password");
  const passwordError = checkNewPassword(body.newPassword);
  if (passwordError) return fail(passwordError);
  return { ok: true, value: { currentPassword, newPassword: body.newPassword as string } };
}

export function parseEmailChange(body: unknown): Parsed<ChangeEmailPayload> {
  if (!isObject(body)) return fail("invalid request");
  const currentPassword = parseCurrentPassword(body.currentPassword);
  if (!currentPassword) return fail("enter your current password");
  const email = normalizeEmail(body.email);
  if (!email) return fail("enter a valid email address");
  return { ok: true, value: { currentPassword, email } };
}

export function parseDeletion(body: unknown): Parsed<DeleteAccountPayload> {
  if (!isObject(body)) return fail("invalid request");
  const password = parseCurrentPassword(body.password);
  if (!password) return fail("enter your password");
  return { ok: true, value: { password } };
}

export function parseSpace(body: unknown): Parsed<CreateSpacePayload> {
  if (!isObject(body)) return fail("invalid request");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_SPACE_NAME_LENGTH) {
    return fail(`name must be 1 to ${MAX_SPACE_NAME_LENGTH} characters`);
  }
  if (body.template !== undefined && !isSpaceTemplate(body.template)) {
    return fail("unknown template");
  }
  if (body.size !== undefined && !isSpaceSize(body.size)) return fail("unknown size");
  return {
    ok: true,
    value: {
      name,
      ...(body.template ? { template: body.template } : {}),
      ...(body.size ? { size: body.size } : {}),
    },
  };
}

export function parseInviteOptions(body: unknown): Parsed<InviteOptions> {
  if (!isObject(body)) return fail("invalid request");
  const { requiresApproval, expiresInHours } = body;
  if (typeof requiresApproval !== "boolean") return fail("invalid request");
  if (
    expiresInHours !== null &&
    (typeof expiresInHours !== "number" ||
      !Number.isInteger(expiresInHours) ||
      expiresInHours < 1 ||
      expiresInHours > MAX_INVITE_HOURS)
  ) {
    return fail("invalid expiry");
  }
  return { ok: true, value: { requiresApproval, expiresInHours } };
}
