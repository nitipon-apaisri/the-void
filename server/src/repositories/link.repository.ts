// shared
import type { MapPortal, SpaceLink } from "@void/shared";

import type { Queryable } from "./user.repository.js";

export interface StoredPortal extends MapPortal {
  placedBy: string | null;
}

export interface LinkRepository {
  /** Replaces the space's connect code; the old one stops working. */
  setConnectCode(spaceId: string, codeHash: string): Promise<void>;
  findByConnectCode(codeHash: string): Promise<{ id: string; name: string } | undefined>;
  list(spaceId: string): Promise<SpaceLink[]>;
  countLive(spaceId: string): Promise<number>;
  /** False when the two spaces already have a live link (pending or approved). */
  request(requesterId: string, targetId: string, userId: string): Promise<boolean>;
  /** Only the side that was asked can approve. False if there is nothing pending for it. */
  approve(spaceId: string, linkId: string, userId: string): Promise<boolean>;
  /**
   * Either side ends a link or declines a request. Portals stay on the map: using one after
   * that tells the person the connection is closed. False if the link is not one of this space's.
   */
  end(spaceId: string, linkId: string): Promise<boolean>;
  /** Whether the two spaces have an approved link, whichever side asked. */
  isApproved(a: string, b: string): Promise<boolean>;
  listPortals(spaceId: string): Promise<StoredPortal[]>;
  addPortal(
    spaceId: string,
    targetId: string,
    col: number,
    row: number,
    userId: string,
  ): Promise<string>;
  removePortal(spaceId: string, id: string): Promise<boolean>;
  setPortalClosed(spaceId: string, id: string, closed: boolean): Promise<boolean>;
}

interface LinkRow {
  id: string;
  status: SpaceLink["status"];
  outgoing: boolean;
  other_id: string;
  other_name: string;
}

export function createLinkRepository(db: Queryable): LinkRepository {
  return {
    async setConnectCode(spaceId, codeHash) {
      await db.query(
        "update t_spaces set connect_code_hash = $2, updated_at = now() where id = $1",
        [spaceId, codeHash],
      );
    },

    async findByConnectCode(codeHash) {
      const { rows } = await db.query<{ id: string; name: string }>(
        "select id, name from t_spaces where connect_code_hash = $1 and deleted_at is null",
        [codeHash],
      );
      return rows[0];
    },

    async list(spaceId) {
      const { rows } = await db.query<LinkRow>(
        `select l.id, l.status, (l.requester_id = $1) as outgoing,
                o.id as other_id, o.name as other_name
         from t_space_links l
         join t_spaces o on o.id = case when l.requester_id = $1 then l.target_id else l.requester_id end
         where (l.requester_id = $1 or l.target_id = $1) and l.deleted_at is null
           and o.deleted_at is null
         order by l.created_at`,
        [spaceId],
      );
      return rows.map((r) => ({
        id: r.id,
        status: r.status,
        direction: r.outgoing ? "outgoing" : "incoming",
        space: { id: r.other_id, name: r.other_name },
      }));
    },

    async countLive(spaceId) {
      const { rows } = await db.query<{ n: string }>(
        `select count(*) as n from t_space_links
         where (requester_id = $1 or target_id = $1) and deleted_at is null`,
        [spaceId],
      );
      return Number(rows[0]?.n ?? 0);
    },

    async request(requesterId, targetId, userId) {
      const { rows } = await db.query(
        `insert into t_space_links (requester_id, target_id, requested_by) values ($1, $2, $3)
         on conflict (least(requester_id, target_id), greatest(requester_id, target_id))
           where deleted_at is null do nothing
         returning id`,
        [requesterId, targetId, userId],
      );
      return rows.length > 0;
    },

    async approve(spaceId, linkId, userId) {
      const { rows } = await db.query(
        `update t_space_links set status = 'approved', approved_by = $3, updated_at = now()
         where id = $2 and target_id = $1 and status = 'pending' and deleted_at is null
         returning id`,
        [spaceId, linkId, userId],
      );
      return rows.length > 0;
    },

    async end(spaceId, linkId) {
      const { rows } = await db.query(
        `update t_space_links set deleted_at = now(), updated_at = now()
         where id = $2 and (requester_id = $1 or target_id = $1) and deleted_at is null
         returning id`,
        [spaceId, linkId],
      );
      return rows.length > 0;
    },

    async isApproved(a, b) {
      const { rows } = await db.query(
        `select 1 from t_space_links l
         join t_spaces sa on sa.id = $1 and sa.deleted_at is null
         join t_spaces sb on sb.id = $2 and sb.deleted_at is null
         where l.status = 'approved' and l.deleted_at is null
           and ((l.requester_id = $1 and l.target_id = $2) or (l.requester_id = $2 and l.target_id = $1))`,
        [a, b],
      );
      return rows.length > 0;
    },

    async listPortals(spaceId) {
      const { rows } = await db.query<{
        id: string;
        col: number;
        row: number;
        target_id: string;
        target_name: string;
        closed: boolean;
        placed_by: string | null;
      }>(
        `select p.id, p.col, p.row, p.target_id, t.name as target_name, p.closed, p.placed_by
         from t_space_portals p join t_spaces t on t.id = p.target_id
         where p.space_id = $1 and p.deleted_at is null and t.deleted_at is null
         order by p.created_at`,
        [spaceId],
      );
      return rows.map((r) => ({
        id: r.id,
        col: r.col,
        row: r.row,
        targetId: r.target_id,
        targetName: r.target_name,
        closed: r.closed,
        placedBy: r.placed_by,
      }));
    },

    async addPortal(spaceId, targetId, col, row, userId) {
      const { rows } = await db.query<{ id: string }>(
        `insert into t_space_portals (space_id, target_id, col, row, placed_by)
         values ($1, $2, $3, $4, $5) returning id`,
        [spaceId, targetId, col, row, userId],
      );
      return rows[0]!.id;
    },

    async removePortal(spaceId, id) {
      const { rows } = await db.query(
        `update t_space_portals set deleted_at = now(), updated_at = now()
         where space_id = $1 and id = $2 and deleted_at is null returning id`,
        [spaceId, id],
      );
      return rows.length > 0;
    },

    async setPortalClosed(spaceId, id, closed) {
      const { rows } = await db.query(
        `update t_space_portals set closed = $3, updated_at = now()
         where space_id = $1 and id = $2 and deleted_at is null returning id`,
        [spaceId, id, closed],
      );
      return rows.length > 0;
    },
  };
}
