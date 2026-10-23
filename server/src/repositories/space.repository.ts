// shared
import {
  DEFAULT_LOOK,
  decodeLook,
  type SpaceMember,
  type SpaceRole,
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
  create(name: string, ownerId: string): Promise<SpaceSummary>;
  countOwned(ownerId: string): Promise<number>;
  listForUser(userId: string): Promise<SpaceSummary[]>;
  findMembership(spaceId: string, userId: string): Promise<Membership | undefined>;
  /** Everyone in the space, owner first. Offline or online is the room's business, not ours. */
  listMembers(spaceId: string): Promise<SpaceMember[]>;
  savePosition(spaceId: string, userId: string, x: number, y: number): Promise<void>;
}

interface SummaryRow {
  id: string;
  name: string;
  template: SpaceTemplate;
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
  role: row.role,
});

// A uuid column rejects anything else with an error, so check the shape before asking.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

export function createSpaceRepository(db: Queryable): SpaceRepository {
  return {
    async create(name, ownerId) {
      const { rows } = await db.query<SummaryRow>(
        `with space as (
           insert into t_spaces (name, owner_id) values ($1, $2) returning id, name, template
         ), member as (
           insert into t_space_members (space_id, user_id, role)
           select id, $2, 'owner' from space
         )
         select id, name, template, 'owner' as role from space`,
        [name, ownerId],
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
        `select s.id, s.name, s.template, m.role
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

    async savePosition(spaceId, userId, x, y) {
      await db.query(
        `update t_space_members set last_x = $3, last_y = $4, updated_at = now()
         where space_id = $1 and user_id = $2 and deleted_at is null`,
        [spaceId, userId, x, y],
      );
    },
  };
}
