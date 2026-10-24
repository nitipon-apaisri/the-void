// shared
import type { AddZonePayload } from "@void/shared";

import type { Queryable } from "./user.repository.js";

/** A room an owner or admin drew, in tiles. */
export interface StoredZone extends AddZonePayload {
  id: string;
  name: string;
}

export interface ZoneRepository {
  list(spaceId: string): Promise<StoredZone[]>;
  /** Stores a room and returns its id. */
  add(spaceId: string, name: string, rect: AddZonePayload, userId: string): Promise<string>;
  /** False when there is no such room in the space. */
  remove(spaceId: string, id: string): Promise<boolean>;
}

export function createZoneRepository(db: Queryable): ZoneRepository {
  return {
    async list(spaceId) {
      const { rows } = await db.query<StoredZone>(
        `select id, name, col, row, cols, rows from t_space_zones
         where space_id = $1 and deleted_at is null order by created_at`,
        [spaceId],
      );
      return rows;
    },

    async add(spaceId, name, { col, row, cols, rows }, userId) {
      const { rows: created } = await db.query<{ id: string }>(
        `insert into t_space_zones (space_id, name, col, row, cols, rows, created_by)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [spaceId, name, col, row, cols, rows, userId],
      );
      return created[0]!.id;
    },

    async remove(spaceId, id) {
      const { rows } = await db.query(
        `update t_space_zones set deleted_at = now(), updated_at = now()
         where space_id = $1 and id = $2 and deleted_at is null returning id`,
        [spaceId, id],
      );
      return rows.length > 0;
    },
  };
}
