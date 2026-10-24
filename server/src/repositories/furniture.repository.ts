// shared
import type { PlacedFurniture } from "@void/shared";

import type { Queryable } from "./user.repository.js";

/** A stored piece and who put it there (null for rows from before that was recorded). */
export interface StoredFurniture extends PlacedFurniture {
  placedBy: string | null;
}

export interface FurnitureRepository {
  list(spaceId: string): Promise<StoredFurniture[]>;
  /** Stores a piece and returns its id. */
  add(spaceId: string, itemId: string, col: number, row: number, userId: string): Promise<string>;
  /** False when there is no such piece in the space. */
  remove(spaceId: string, id: string): Promise<boolean>;
  /** Removes every piece placed in the space. */
  clear(spaceId: string): Promise<void>;
}

export function createFurnitureRepository(db: Queryable): FurnitureRepository {
  return {
    async list(spaceId) {
      const { rows } = await db.query<{
        id: string;
        item_id: string;
        col: number;
        row: number;
        placed_by: string | null;
      }>(
        `select id, item_id, col, row, placed_by from t_furniture
         where space_id = $1 and deleted_at is null order by created_at`,
        [spaceId],
      );
      return rows.map((r) => ({
        id: r.id,
        itemId: r.item_id,
        col: r.col,
        row: r.row,
        placedBy: r.placed_by,
      }));
    },

    async add(spaceId, itemId, col, row, userId) {
      const { rows } = await db.query<{ id: string }>(
        `insert into t_furniture (space_id, item_id, col, row, placed_by) values ($1, $2, $3, $4, $5)
         returning id`,
        [spaceId, itemId, col, row, userId],
      );
      return rows[0]!.id;
    },

    async remove(spaceId, id) {
      const { rows } = await db.query(
        `update t_furniture set deleted_at = now(), updated_at = now()
         where space_id = $1 and id = $2 and deleted_at is null returning id`,
        [spaceId, id],
      );
      return rows.length > 0;
    },

    async clear(spaceId) {
      await db.query(
        `update t_furniture set deleted_at = now(), updated_at = now()
         where space_id = $1 and deleted_at is null`,
        [spaceId],
      );
    },
  };
}
