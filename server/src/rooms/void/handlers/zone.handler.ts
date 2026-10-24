// shared
import type { AddZonePayload, RemoveZonePayload } from "@void/shared";

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
