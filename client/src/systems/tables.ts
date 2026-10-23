// shared
import { tableInRange, type MapTable, type Position } from "@void/shared";

export interface Claim {
  userId: string;
  name: string;
}

export type TablePrompt =
  | { kind: "claim"; table: MapTable }
  | { kind: "release"; table: MapTable }
  | { kind: "taken"; table: MapTable; owner: string }
  /** Near a free desk while already holding another one. */
  | { kind: "has-desk"; table: MapTable };

/** What the desk next to you offers, or undefined when you are not near one. */
export function tablePrompt(
  tables: readonly MapTable[],
  claims: ReadonlyMap<string, Claim>,
  myUserId: string,
  pos: Position,
): TablePrompt | undefined {
  const table = tableInRange(tables, pos);
  if (!table) return undefined;
  const claim = claims.get(table.id);
  if (claim) {
    return claim.userId === myUserId
      ? { kind: "release", table }
      : { kind: "taken", table, owner: claim.name };
  }
  for (const other of claims.values()) {
    if (other.userId === myUserId) return { kind: "has-desk", table };
  }
  return { kind: "claim", table };
}
