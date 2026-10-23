// shared
import {
  findFurniture,
  type FurnitureItem,
  type PlaceFurniturePayload,
  type RemoveFurniturePayload,
} from "@void/shared";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** A clean place request, or null. Item existence is checked by the caller against the catalogue. */
export function parsePlace(
  payload: unknown,
): (PlaceFurniturePayload & { item: FurnitureItem }) | null {
  if (!isObject(payload)) return null;
  const { itemId, col, row } = payload;
  if (typeof itemId !== "string" || !Number.isInteger(col) || !Number.isInteger(row)) return null;
  const item = findFurniture(itemId);
  if (!item) return null;
  return { itemId, col: col as number, row: row as number, item };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRemove(payload: unknown): RemoveFurniturePayload | null {
  if (!isObject(payload)) return null;
  const { id } = payload;
  return typeof id === "string" && UUID.test(id) ? { id } : null;
}
