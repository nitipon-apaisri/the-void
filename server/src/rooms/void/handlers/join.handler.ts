// shared
import { AVATAR_COLORS, MAX_NAME_LENGTH } from "@void/shared";

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "guest";
  const name = raw.trim().slice(0, MAX_NAME_LENGTH);
  return name || "guest";
}

export function sanitizeAvatar(raw: unknown): number {
  return Number.isInteger(raw) && (raw as number) >= 0 && (raw as number) < AVATAR_COLORS.length
    ? (raw as number)
    : 0;
}
