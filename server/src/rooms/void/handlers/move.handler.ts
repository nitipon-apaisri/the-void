// shared
import { WORLD_HEIGHT, WORLD_WIDTH, type MovePayload } from "@void/shared";

/** Returns a clean position, or null if the client sent something we should ignore. */
export function parseMove(payload: unknown): MovePayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { x, y } = payload as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || x > WORLD_WIDTH || y < 0 || y > WORLD_HEIGHT) return null;
  return { x, y };
}
