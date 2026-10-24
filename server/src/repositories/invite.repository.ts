// shared
import { DEFAULT_LOOK, decodeLook, type InviteSummary, type JoinRequest } from "@void/shared";

import type { Queryable } from "./user.repository.js";

export interface InviteTarget {
  id: string;
  spaceId: string;
  spaceName: string;
  requiresApproval: boolean;
}

export interface NewInvite {
  spaceId: string;
  tokenHash: string;
  /** Keyed hash of the short code (see the invite service). */
  codeHash: string;
  requiresApproval: boolean;
  /** Null for a link that never expires. */
  expiresInHours: number | null;
  createdBy: string;
}

export interface InviteRepository {
  create(invite: NewInvite): Promise<InviteSummary>;
  countActive(spaceId: string): Promise<number>;
  listActive(spaceId: string): Promise<InviteSummary[]>;
  /** True if a link was revoked. */
  revoke(spaceId: string, inviteId: string): Promise<boolean>;
  /** Only links that are not revoked, not expired, and whose space still exists. */
  findByHash(tokenHash: string): Promise<InviteTarget | undefined>;
  /** The same, found by the keyed hash of its short code. */
  findByCodeHash(codeHash: string): Promise<InviteTarget | undefined>;
  /** Asks to join; asking again while one is pending changes nothing. */
  requestJoin(spaceId: string, userId: string): Promise<void>;
  listRequests(spaceId: string): Promise<JoinRequest[]>;
  /** Approving also adds the member, in the same statement. False if there was nothing pending. */
  decide(spaceId: string, userId: string, approve: boolean): Promise<boolean>;
}

interface InviteRow {
  id: string;
  requires_approval: boolean;
  expires_at: Date | null;
  created_at: Date;
  created_by_name: string;
}

const toSummary = (row: InviteRow): InviteSummary => ({
  id: row.id,
  requiresApproval: row.requires_approval,
  expiresAt: row.expires_at && row.expires_at.toISOString(),
  createdAt: row.created_at.toISOString(),
  createdByName: row.created_by_name,
});

const ACTIVE = "i.deleted_at is null and (i.expires_at is null or i.expires_at > now())";

// `column` is one of two literals below, never input.
async function findActive(
  db: Queryable,
  column: "token_hash" | "code_hash",
  hash: string,
): Promise<InviteTarget | undefined> {
  const { rows } = await db.query<{
    id: string;
    space_id: string;
    name: string;
    requires_approval: boolean;
  }>(
    `select i.id, i.space_id, s.name, i.requires_approval
     from t_space_invites i join t_spaces s on s.id = i.space_id
     where i.${column} = $1 and ${ACTIVE} and s.deleted_at is null`,
    [hash],
  );
  const row = rows[0];
  return (
    row && {
      id: row.id,
      spaceId: row.space_id,
      spaceName: row.name,
      requiresApproval: row.requires_approval,
    }
  );
}

export function createInviteRepository(db: Queryable): InviteRepository {
  return {
    async create(invite) {
      const { rows } = await db.query<InviteRow>(
        `with made as (
           insert into t_space_invites (space_id, token_hash, code_hash, requires_approval, expires_at, created_by)
           values ($1, $2, $6, $3, case when $4::int is null then null else now() + make_interval(hours => $4::int) end, $5)
           returning id, requires_approval, expires_at, created_at, created_by
         )
         select i.id, i.requires_approval, i.expires_at, i.created_at, u.display_name as created_by_name
         from made i join t_users u on u.id = i.created_by`,
        [
          invite.spaceId,
          invite.tokenHash,
          invite.requiresApproval,
          invite.expiresInHours,
          invite.createdBy,
          invite.codeHash,
        ],
      );
      return toSummary(rows[0]!);
    },

    async countActive(spaceId) {
      const { rows } = await db.query<{ count: string }>(
        `select count(*) from t_space_invites i where i.space_id = $1 and ${ACTIVE}`,
        [spaceId],
      );
      return Number(rows[0]!.count);
    },

    async listActive(spaceId) {
      const { rows } = await db.query<InviteRow>(
        `select i.id, i.requires_approval, i.expires_at, i.created_at, u.display_name as created_by_name
         from t_space_invites i join t_users u on u.id = i.created_by
         where i.space_id = $1 and ${ACTIVE}
         order by i.created_at desc`,
        [spaceId],
      );
      return rows.map(toSummary);
    },

    async revoke(spaceId, inviteId) {
      const { rows } = await db.query(
        `update t_space_invites set deleted_at = now(), updated_at = now()
         where id = $1 and space_id = $2 and deleted_at is null returning id`,
        [inviteId, spaceId],
      );
      return rows.length > 0;
    },

    findByHash: (tokenHash) => findActive(db, "token_hash", tokenHash),
    findByCodeHash: (codeHash) => findActive(db, "code_hash", codeHash),

    async requestJoin(spaceId, userId) {
      await db.query(
        `insert into t_space_join_requests (space_id, user_id) values ($1, $2)
         on conflict (space_id, user_id) where status = 'pending' and deleted_at is null do nothing`,
        [spaceId, userId],
      );
    },

    async listRequests(spaceId) {
      const { rows } = await db.query<{
        user_id: string;
        display_name: string;
        look: string;
        created_at: Date;
      }>(
        `select r.user_id, u.display_name, u.look, r.created_at
         from t_space_join_requests r join t_users u on u.id = r.user_id
         where r.space_id = $1 and r.status = 'pending' and r.deleted_at is null and u.deleted_at is null
         order by r.created_at`,
        [spaceId],
      );
      return rows.map((row) => ({
        userId: row.user_id,
        name: row.display_name,
        look: decodeLook(row.look) ?? DEFAULT_LOOK,
        createdAt: row.created_at.toISOString(),
      }));
    },

    async decide(spaceId, userId, approve) {
      const { rows } = await db.query(
        `with decided as (
           update t_space_join_requests
           set status = case when $3 then 'approved' else 'denied' end, updated_at = now()
           where space_id = $1 and user_id = $2 and status = 'pending' and deleted_at is null
           returning user_id
         ), added as (
           insert into t_space_members (space_id, user_id, role)
           select $1, user_id, 'member' from decided
           where $3 and not exists (select 1 from t_space_bans
                                    where space_id = $1 and user_id = $2 and deleted_at is null)
           on conflict (space_id, user_id) where deleted_at is null do nothing
         )
         select user_id from decided`,
        [spaceId, userId, approve],
      );
      return rows.length > 0;
    },
  };
}
