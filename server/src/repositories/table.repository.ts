import type { Queryable } from "./user.repository.js";

export interface TableClaim {
  tableId: string;
  userId: string;
  name: string;
}

export interface TableRepository {
  /** Every current claim in the space, with the claimer's display name. */
  listClaims(spaceId: string): Promise<TableClaim[]>;
  /** False when the desk was taken or the person already holds one (the unique indexes decide). */
  claim(spaceId: string, tableId: string, userId: string): Promise<boolean>;
  /** Gives up the person's desk and returns its id, or undefined if they had none. */
  release(spaceId: string, userId: string): Promise<string | undefined>;
}

export function createTableRepository(db: Queryable): TableRepository {
  return {
    async listClaims(spaceId) {
      const { rows } = await db.query<{ table_id: string; user_id: string; display_name: string }>(
        `select c.table_id, c.user_id, u.display_name
         from t_table_claims c join t_users u on u.id = c.user_id
         where c.space_id = $1 and c.deleted_at is null and u.deleted_at is null`,
        [spaceId],
      );
      return rows.map((r) => ({ tableId: r.table_id, userId: r.user_id, name: r.display_name }));
    },

    async claim(spaceId, tableId, userId) {
      const { rows } = await db.query(
        `insert into t_table_claims (space_id, table_id, user_id) values ($1, $2, $3)
         on conflict do nothing returning table_id`,
        [spaceId, tableId, userId],
      );
      return rows.length > 0;
    },

    async release(spaceId, userId) {
      const { rows } = await db.query<{ table_id: string }>(
        `update t_table_claims set deleted_at = now(), updated_at = now()
         where space_id = $1 and user_id = $2 and deleted_at is null returning table_id`,
        [spaceId, userId],
      );
      return rows[0]?.table_id;
    },
  };
}
