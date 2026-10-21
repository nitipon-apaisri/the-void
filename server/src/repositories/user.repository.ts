export interface Queryable {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[] }>;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatar: number;
  lastX: number | null;
  lastY: number | null;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar: number;
  last_x: number | null;
  last_y: number | null;
}

const COLUMNS = "id, email, password_hash, display_name, avatar, last_x, last_y";

const toRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  name: row.display_name,
  avatar: row.avatar,
  lastX: row.last_x,
  lastY: row.last_y,
});

export interface NewUser {
  email: string;
  passwordHash: string;
  name: string;
  avatar: number;
}

export interface UserRepository {
  /** Undefined when the email is already taken. */
  create(user: NewUser): Promise<UserRecord | undefined>;
  findByEmail(email: string): Promise<UserRecord | undefined>;
  findById(id: string): Promise<UserRecord | undefined>;
  savePosition(id: string, x: number, y: number): Promise<void>;
}

export function createUserRepository(db: Queryable): UserRepository {
  return {
    async create(user) {
      const { rows } = await db.query<UserRow>(
        `insert into t_users (email, password_hash, display_name, avatar)
         values ($1, $2, $3, $4)
         on conflict (email) where deleted_at is null do nothing
         returning ${COLUMNS}`,
        [user.email, user.passwordHash, user.name, user.avatar],
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
  };
}
