// shared
import type { CrossPayload, PlacePortalPayload, RemovePortalPayload } from "@void/shared";

import { isUuid } from "../../../repositories/space.repository.js";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** A clean place request, or null. Whether the target is linked is the caller's check. */
export function parsePlacePortal(payload: unknown): PlacePortalPayload | null {
  if (!isObject(payload)) return null;
  const { targetId, col, row } = payload;
  if (!isUuid(targetId) || !Number.isInteger(col) || !Number.isInteger(row)) return null;
  return { targetId, col: col as number, row: row as number };
}

export function parseRemovePortal(payload: unknown): RemovePortalPayload | null {
  if (!isObject(payload)) return null;
  return isUuid(payload.id) ? { id: payload.id } : null;
}

export function parseCross(payload: unknown): CrossPayload | null {
  if (!isObject(payload)) return null;
  return isUuid(payload.id) ? { id: payload.id } : null;
}
