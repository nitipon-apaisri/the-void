// shared
import { DEFAULT_LOOK, decodeLook, type BannedMember } from "@void/shared";

import type { Queryable } from "./user.repository.js";

export interface BanRepository {
  /**
   * Bans the user, takes them out of the space and declines their pending request, in one
   * statement. False if they were already banned.
   */
  ban(spaceId: string, userId: string, bannedBy: string): Promise<boolean>;
  /** Lifts the ban; they still need a new link or code to come back. False if not banned. */
  unban(spaceId: string, userId: string): Promise<boolean>;
  list(spaceId: string): Promise<BannedMember[]>;
  isBanned(spaceId: string, userId: string): Promise<boolean>;
}

interface BanRow {
  user_id: string;
  display_name: string;
  look: string;
  created_at: Date;
}

export function createBanRepository(db: Queryable): BanRepository {
  return {
    async ban(spaceId, userId, bannedBy) {
      const { rows } = await db.query(
        `with banned as (
           insert into t_space_bans (space_id, user_id, banned_by) values ($1, $2, $3)
           on conflict (space_id, user_id) where deleted_at is null do nothing
           returning user_id
         ), left_space as (
           update t_space_members set deleted_at = now(), updated_at = now()
           where space_id = $1 and user_id = $2 and deleted_at is null
             and exists (select 1 from banned)
         ), declined as (
           update t_space_join_requests set status = 'denied', updated_at = now()
           where space_id = $1 and user_id = $2 and status = 'pending' and deleted_at is null
             and exists (select 1 from banned)
         )
         select user_id from banned`,
        [spaceId, userId, bannedBy],
      );
      return rows.length > 0;
    },

    async unban(spaceId, userId) {
      const { rows } = await db.query(
        `update t_space_bans set deleted_at = now(), updated_at = now()
         where space_id = $1 and user_id = $2 and deleted_at is null returning user_id`,
        [spaceId, userId],
      );
      return rows.length > 0;
    },

    async list(spaceId) {
      const { rows } = await db.query<BanRow>(
        `select u.id as user_id, u.display_name, u.look, b.created_at
         from t_space_bans b join t_users u on u.id = b.user_id
         where b.space_id = $1 and b.deleted_at is null and u.deleted_at is null
         order by b.created_at desc`,
        [spaceId],
      );
      return rows.map((row) => ({
        userId: row.user_id,
        name: row.display_name,
        look: decodeLook(row.look) ?? DEFAULT_LOOK,
        bannedAt: row.created_at.toISOString(),
      }));
    },

    async isBanned(spaceId, userId) {
      const { rows } = await db.query(
        "select 1 from t_space_bans where space_id = $1 and user_id = $2 and deleted_at is null",
        [spaceId, userId],
      );
      return rows.length > 0;
    },
  };
}
