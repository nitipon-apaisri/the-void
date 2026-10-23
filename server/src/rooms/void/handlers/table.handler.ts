// shared
import { tableInRange, type ClaimTablePayload, type MapTable, type Position } from "@void/shared";

/** The payload of a claim request, or null if it is not one. */
export function parseClaim(payload: unknown): ClaimTablePayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { tableId } = payload as { tableId?: unknown };
  return typeof tableId === "string" && tableId.length <= 16 ? { tableId } : null;
}

export type ClaimCheck = { ok: true; table: MapTable } | { ok: false; error: string };

/** Whether this person may claim this desk right now. Races are settled by the database. */
export function checkClaim(
  tables: readonly MapTable[],
  claimed: ReadonlyMap<string, { userId: string }>,
  userId: string,
  tableId: string,
  pos: Position,
): ClaimCheck {
  const table = tables.find((t) => t.id === tableId);
  if (!table) return { ok: false, error: "that desk does not exist" };
  if (claimed.has(tableId)) return { ok: false, error: "that desk is taken" };
  for (const claim of claimed.values()) {
    if (claim.userId === userId) return { ok: false, error: "you already have a desk" };
  }
  // The nearest table in range decides, so a claim cannot be made from across the map.
  if (tableInRange([table], pos) !== table)
    return { ok: false, error: "walk up to the desk first" };
  return { ok: true, table };
}
