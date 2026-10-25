// shared
import { isPlayerStatus, type SetStatusPayload } from "@void/shared";

export function parseSetStatus(payload: unknown): SetStatusPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { status } = payload as { status?: unknown };
  return isPlayerStatus(status) ? { status } : null;
}
