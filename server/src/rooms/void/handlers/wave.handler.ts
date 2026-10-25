// shared
import { WAVE_COOLDOWN_MS, WAVE_RANGE, type Position, type WavePayload } from "@void/shared";

/** The payload of a wave, or null if it is not one. */
export function parseWave(payload: unknown): WavePayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { targetId } = payload as { targetId?: unknown };
  return typeof targetId === "string" && targetId.length > 0 && targetId.length <= 64
    ? { targetId }
    : null;
}

/** Whether a wave from `from` at `to` is allowed now; `lastAt` is the sender's previous wave. */
export function canWave(
  from: Position,
  to: Position,
  selfWave: boolean,
  now: number,
  lastAt: number | undefined,
  // Someone on do not disturb is not waved at.
  targetBusy = false,
): boolean {
  if (selfWave || targetBusy) return false;
  if (lastAt !== undefined && now - lastAt < WAVE_COOLDOWN_MS) return false;
  return Math.hypot(to.x - from.x, to.y - from.y) <= WAVE_RANGE;
}
