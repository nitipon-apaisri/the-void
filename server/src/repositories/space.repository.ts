// shared
import {
  DEFAULT_LOOK,
  DEFAULT_SIZE,
  decodeLook,
  isSpaceSize,
  isSpaceTemplate,
  type SpaceMember,
  type SpaceRole,
  type SpaceSize,
  type SpaceSummary,
  type SpaceTemplate,
} from "@void/shared";

import type { Queryable } from "./user.repository.js";

export interface Membership {
  role: SpaceRole;
  lastX: number | null;
  lastY: number | null;
}

export interface SpaceRepository {
  /** Creates the space and makes `ownerId` its owner in one statement. */
  create(
    name: string,
    ownerId: string,
    template: SpaceTemplate,
    size: SpaceSize,
  ): Promise<SpaceSummary>;
  countOwned(ownerId: string): Promise<number>;
  listForUser(userId: string): Promise<SpaceSummary[]>;
  findMembership(spaceId: string, userId: string): Promise<Membership | undefined>;
  /** Everyone in the space, owner first. Offline or online is the room's business, not ours. */
  listMembers(spaceId: string): Promise<SpaceMember[]>;
  savePosition(spaceId: string, userId: string, x: number, y: number): Promise<void>;
  /** Adds a plain member; does nothing if they already belong. */
  addMember(spaceId: string, userId: string): Promise<void>;
  findSummary(spaceId: string, userId: string): Promise<SpaceSummary | undefined>;
  /** Which map the space uses; undefined for a space that does not exist. */
  findLayout(spaceId: string): Promise<{ template: SpaceTemplate; size: SpaceSize } | undefined>;
  setTemplate(spaceId: string, template: SpaceTemplate): Promise<void>;
  /** Takes a member out of the space (their row stays, deleted_at). False if they were not in it. */
  removeMember(spaceId: string, userId: string): Promise<boolean>;
  /** Admin or member. False if they are not a non-owner member of the space. */
  setRole(spaceId: string, userId: string, role: "admin" | "member"): Promise<boolean>;
  /** Makes `toId` the owner and `fromId` an admin in one statement. False if `fromId` is not the owner. */
  transferOwnership(spaceId: string, fromId: string, toId: string): Promise<boolean>;
  /**
   * For a closing account: each space the user owns goes to its longest-standing admin (or else
   * member), a space nobody else is in is closed, and the user leaves every space they were in.
   */
  handOverOwned(userId: string): Promise<void>;
}

interface SummaryRow {
  id: string;
  name: string;
  template: SpaceTemplate;
  size: SpaceSize;
  role: SpaceRole;
}

interface MemberRow {
  user_id: string;
  display_name: string;
  look: string;
  role: SpaceRole;
}

const toSummary = (row: SummaryRow): SpaceSummary => ({
  id: row.id,
  name: row.name,
  template: row.template,
  size: row.size,
  role: row.role,
});

// A uuid column rejects anything else with an error, so check the shape before asking.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

export function createSpaceRepository(db: Queryable): SpaceRepository {
  return {
    async create(name, ownerId, template, size) {
      const { rows } = await db.query<SummaryRow>(
        `with space as (
           insert into t_spaces (name, owner_id, template, size) values ($1, $2, $3, $4) returning id, name, template, size
         ), member as (
           insert into t_space_members (space_id, user_id, role)
           select id, $2, 'owner' from space
         )
         select id, name, template, size, 'owner' as role from space`,
        [name, ownerId, template, size],
      );
      return toSummary(rows[0]!);
    },

    async countOwned(ownerId) {
      const { rows } = await db.query<{ count: string }>(
        "select count(*) from t_spaces where owner_id = $1 and deleted_at is null",
        [ownerId],
      );
      return Number(rows[0]!.count);
    },

    async listForUser(userId) {
      const { rows } = await db.query<SummaryRow>(
        `select s.id, s.name, s.template, s.size, m.role
         from t_space_members m join t_spaces s on s.id = m.space_id
         where m.user_id = $1 and m.deleted_at is null and s.deleted_at is null
         order by s.created_at`,
        [userId],
      );
      return rows.map(toSummary);
    },

    async findMembership(spaceId, userId) {
      const { rows } = await db.query<{
        role: SpaceRole;
        last_x: number | null;
        last_y: number | null;
      }>(
        `select m.role, m.last_x, m.last_y
         from t_space_members m join t_spaces s on s.id = m.space_id
         where m.space_id = $1 and m.user_id = $2 and m.deleted_at is null and s.deleted_at is null`,
        [spaceId, userId],
      );
      const row = rows[0];
      return row && { role: row.role, lastX: row.last_x, lastY: row.last_y };
    },

    async listMembers(spaceId) {
      const { rows } = await db.query<MemberRow>(
        `select u.id as user_id, u.display_name, u.look, m.role
         from t_space_members m join t_users u on u.id = m.user_id
         where m.space_id = $1 and m.deleted_at is null and u.deleted_at is null
         order by (m.role = 'owner') desc, (m.role = 'admin') desc, lower(u.display_name)`,
        [spaceId],
      );
      return rows.map((row) => ({
        userId: row.user_id,
        name: row.display_name,
        look: decodeLook(row.look) ?? DEFAULT_LOOK,
        role: row.role,
      }));
    },

    async addMember(spaceId, userId) {
      await db.query(
        `insert into t_space_members (space_id, user_id, role) values ($1, $2, 'member')
         on conflict (space_id, user_id) where deleted_at is null do nothing`,
        [spaceId, userId],
      );
    },

    async findSummary(spaceId, userId) {
      const { rows } = await db.query<SummaryRow>(
        `select s.id, s.name, s.template, s.size, m.role
         from t_space_members m join t_spaces s on s.id = m.space_id
         where m.space_id = $1 and m.user_id = $2 and m.deleted_at is null and s.deleted_at is null`,
        [spaceId, userId],
      );
      return rows[0] && toSummary(rows[0]);
    },

    async findLayout(spaceId) {
      const { rows } = await db.query<{ template: string; size: string }>(
        "select template, size from t_spaces where id = $1 and deleted_at is null",
        [spaceId],
      );
      const { template, size } = rows[0] ?? {};
      if (!isSpaceTemplate(template)) return undefined;
      return { template, size: isSpaceSize(size) ? size : DEFAULT_SIZE };
    },

    async setTemplate(spaceId, template) {
      await db.query(
        "update t_spaces set template = $2, updated_at = now() where id = $1 and deleted_at is null",
        [spaceId, template],
      );
    },

    async removeMember(spaceId, userId) {
      const { rows } = await db.query(
        `update t_space_members set deleted_at = now(), updated_at = now()
         where space_id = $1 and user_id = $2 and deleted_at is null returning user_id`,
        [spaceId, userId],
      );
      return rows.length > 0;
    },

    async setRole(spaceId, userId, role) {
      const { rows } = await db.query(
        `update t_space_members set role = $3, updated_at = now()
         where space_id = $1 and user_id = $2 and role <> 'owner' and deleted_at is null
         returning user_id`,
        [spaceId, userId, role],
      );
      return rows.length > 0;
    },

    async transferOwnership(spaceId, fromId, toId) {
      // One statement, so a crash cannot leave a space with two owners or none.
      const { rows } = await db.query(
        `with moved as (
           update t_spaces set owner_id = $3, updated_at = now()
           where id = $1 and owner_id = $2 and deleted_at is null
             and exists (select 1 from t_space_members
                         where space_id = $1 and user_id = $3 and deleted_at is null)
           returning id
         )
         update t_space_members
         set role = case when user_id = $3 then 'owner' else 'admin' end, updated_at = now()
         where space_id = $1 and user_id in ($2, $3) and deleted_at is null
           and exists (select 1 from moved)
         returning user_id`,
        [spaceId, fromId, toId],
      );
      return rows.length === 2;
    },

    async handOverOwned(userId) {
      await db.query(
        `with owned as (
           select id from t_spaces where owner_id = $1 and deleted_at is null
         ),
         heir as (
           select distinct on (m.space_id) m.space_id, m.user_id
           from t_space_members m join t_users u on u.id = m.user_id and u.deleted_at is null
           where m.space_id in (select id from owned) and m.user_id <> $1 and m.deleted_at is null
           order by m.space_id, (m.role = 'admin') desc, m.created_at
         ),
         moved as (
           update t_spaces s set owner_id = h.user_id, updated_at = now()
           from heir h where s.id = h.space_id returning s.id, h.user_id
         ),
         promoted as (
           update t_space_members m set role = 'owner', updated_at = now()
           from moved mv where m.space_id = mv.id and m.user_id = mv.user_id and m.deleted_at is null
           returning m.user_id
         ),
         closed as (
           update t_spaces set deleted_at = now(), updated_at = now()
           where id in (select id from owned) and id not in (select space_id from heir)
           returning id
         )
         update t_space_members set deleted_at = now(), updated_at = now()
         where user_id = $1 and deleted_at is null`,
        [userId],
      );
    },

    async savePosition(spaceId, userId, x, y) {
      await db.query(
        `update t_space_members set last_x = $3, last_y = $4, updated_at = now()
         where space_id = $1 and user_id = $2 and deleted_at is null`,
        [spaceId, userId, x, y],
      );
    },
  };
}
