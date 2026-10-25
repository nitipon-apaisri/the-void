// shared
import type {
  AddZonePayload,
  AnswerKnockPayload,
  LockZonePayload,
  PresentPayload,
  RemoveZonePayload,
} from "@void/shared";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A well-formed add request, or null. Size, bounds and overlap are checked with `zoneError`. */
export function parseAddZone(payload: unknown): AddZonePayload | null {
  if (!isObject(payload)) return null;
  const { col, row, cols, rows } = payload;
  if (![col, row, cols, rows].every(Number.isInteger)) return null;
  return { col, row, cols, rows } as AddZonePayload;
}

export function parseRemoveZone(payload: unknown): RemoveZonePayload | null {
  if (!isObject(payload)) return null;
  const { id } = payload;
  return typeof id === "string" && UUID.test(id) ? { id } : null;
}

export function parseLockZone(payload: unknown): LockZonePayload | null {
  if (!isObject(payload)) return null;
  const { id, locked } = payload;
  return typeof id === "string" && id.length <= 64 && typeof locked === "boolean"
    ? { id, locked }
    : null;
}

export function parseAnswerKnock(payload: unknown): AnswerKnockPayload | null {
  if (!isObject(payload)) return null;
  const { knockerId, allow } = payload;
  return typeof knockerId === "string" && knockerId.length <= 64 && typeof allow === "boolean"
    ? { knockerId, allow }
    : null;
}

export function parsePresent(payload: unknown): PresentPayload | null {
  if (!isObject(payload)) return null;
  const { on } = payload;
  return typeof on === "boolean" ? { on } : null;
}

/** The name of someone else presenting in this room, or undefined. Open floor has no limit. */
export function presenterIn(
  players: Iterable<{ zone: string; presenting: boolean; name: string }>,
  zoneId: string,
  except: object,
): string | undefined {
  if (!zoneId) return undefined;
  for (const p of players) {
    if (p !== except && p.zone === zoneId && p.presenting) return p.name;
  }
  return undefined;
}
