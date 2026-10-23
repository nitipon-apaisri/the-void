// shared
import { DEFAULT_LOOK, decodeLook, encodeLook, type Look } from "@void/shared";

export interface Queryable {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  look: Look;
  lastX: number | null;
  lastY: number | null;
  /** Tokens issued at an older version are no longer valid. */
  tokenVersion: number;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  look: string;
  last_x: number | null;
  last_y: number | null;
  token_version: number;
}

const COLUMNS = "id, email, password_hash, display_name, look, last_x, last_y, token_version";

const toRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  name: row.display_name,
  // A row that fails to decode would only come from a manual edit; fall back rather than crash.
  look: decodeLook(row.look) ?? DEFAULT_LOOK,
  lastX: row.last_x,
  lastY: row.last_y,
  tokenVersion: row.token_version,
});

const UNIQUE_VIOLATION = "23505";

export interface NewUser {
  email: string;
  passwordHash: string;
  name: string;
  look: Look;
}

export interface UserRepository {
  /** Undefined when the email is already taken. */
  create(user: NewUser): Promise<UserRecord | undefined>;
  findByEmail(email: string): Promise<UserRecord | undefined>;
  findById(id: string): Promise<UserRecord | undefined>;
  savePosition(id: string, x: number, y: number): Promise<void>;
  updateProfile(id: string, name: string, look: Look): Promise<UserRecord | undefined>;
  /** Undefined when the email belongs to another account. */
  updateEmail(id: string, email: string): Promise<UserRecord | undefined>;
  /** Also bumps the token version, which signs every other device out. */
  updatePassword(id: string, passwordHash: string): Promise<UserRecord | undefined>;
  bumpTokenVersion(id: string): Promise<UserRecord | undefined>;
  /** Soft delete: the row stays for audit, the email is free to register again. */
  remove(id: string): Promise<void>;
}

export function createUserRepository(db: Queryable): UserRepository {
  return {
    async create(user) {
      const { rows } = await db.query<UserRow>(
        `insert into t_users (email, password_hash, display_name, look)
         values ($1, $2, $3, $4)
         on conflict (email) where deleted_at is null do nothing
         returning ${COLUMNS}`,
        [user.email, user.passwordHash, user.name, encodeLook(user.look)],
      );
      return rows[0] && toRecord(rows[0]);
    },

    async findByEmail(email) {
      const { rows } = await db.query<UserRow>(
        `select ${COLUMNS} from t_users where email = $1 and deleted_at is null`,
        [email],
      );
      return rows[0] && toRecord(rows[0]);
    },

    async findById(id) {
      const { rows } = await db.query<UserRow>(
        `select ${COLUMNS} from t_users where id = $1 and deleted_at is null`,
        [id],
      );
      return rows[0] && toRecord(rows[0]);
    },

    async savePosition(id, x, y) {
      await db.query(
        "update t_users set last_x = $2, last_y = $3, updated_at = now() where id = $1",
        [id, x, y],
      );
    },

    async updateProfile(id, name, look) {
      const { rows } = await db.query<UserRow>(
        `update t_users set display_name = $2, look = $3, updated_at = now()
         where id = $1 and deleted_at is null returning ${COLUMNS}`,
        [id, name, encodeLook(look)],
      );
      return rows[0] && toRecord(rows[0]);
    },

    async updateEmail(id, email) {
      try {
        const { rows } = await db.query<UserRow>(
          `update t_users set email = $2, updated_at = now()
           where id = $1 and deleted_at is null returning ${COLUMNS}`,
          [id, email],
        );
        return rows[0] && toRecord(rows[0]);
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) return undefined;
        throw err;
      }
    },

    async updatePassword(id, passwordHash) {
      const { rows } = await db.query<UserRow>(
        `update t_users set password_hash = $2, token_version = token_version + 1, updated_at = now()
         where id = $1 and deleted_at is null returning ${COLUMNS}`,
        [id, passwordHash],
      );
      return rows[0] && toRecord(rows[0]);
    },

    async bumpTokenVersion(id) {
      const { rows } = await db.query<UserRow>(
        `update t_users set token_version = token_version + 1, updated_at = now()
         where id = $1 and deleted_at is null returning ${COLUMNS}`,
        [id],
      );
      return rows[0] && toRecord(rows[0]);
    },

    async remove(id) {
      await db.query(
        "update t_users set deleted_at = now(), updated_at = now(), token_version = token_version + 1 where id = $1 and deleted_at is null",
        [id],
      );
    },
  };
}
