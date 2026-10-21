// shared
import { MAX_NAME_LENGTH } from "@void/shared";

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "guest";
  const name = raw.trim().slice(0, MAX_NAME_LENGTH);
  return name || "guest";
}
