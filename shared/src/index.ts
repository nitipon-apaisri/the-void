export const ROOM_NAME = "void";
export const MAX_CLIENTS = 100;
export const MAX_NAME_LENGTH = 24;

// World. Must match client/src/assets/maps/office.tmj (server/src/test/map.spec.ts checks it).
export const TILE_SIZE = 32;
export const MAP_COLS = 90;
export const MAP_ROWS = 67;
export const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
export const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;
// Movement. The server uses these to check a move is possible, the client to make it.
export const PLAYER_SPEED = 180;
// Going to a person from the People panel is quicker than walking. The server's speed limit
// allows this much for everyone, so it is the ceiling a client can reach.
export const PLAYER_RUN_SPEED = PLAYER_SPEED * 2;
export const PLAYER_RADIUS = 12;

// The middle of the central plaza.
export const SPAWN = { x: 45 * TILE_SIZE + TILE_SIZE / 2, y: 33 * TILE_SIZE + TILE_SIZE / 2 };

// A character is five layered parts from the LimeZu character generator, drawn in this order.
// Each value is a position in the pack's sorted file list for that part, so the counts below
// describe pack v41.4 (client/src/utils/look-art.ts reads the same lists). The accessory is
// optional: -1 means none.
export const LOOK_PARTS = ["body", "eyes", "outfit", "hair", "accessory"] as const;
export type LookPart = (typeof LOOK_PARTS)[number];
export type Look = Record<LookPart, number>;
export const LOOK_COUNTS: Record<LookPart, number> = {
  body: 9,
  eyes: 7,
  outfit: 132,
  hair: 200,
  accessory: 84,
};
export const NO_ACCESSORY = -1;
export const DEFAULT_LOOK: Look = { body: 0, eyes: 0, outfit: 0, hair: 0, accessory: NO_ACCESSORY };

const lookInRange = (part: LookPart, value: unknown): value is number =>
  Number.isInteger(value) &&
  (value as number) >= (part === "accessory" ? NO_ACCESSORY : 0) &&
  (value as number) < LOOK_COUNTS[part];

/** True for an object holding exactly an in-range index for every part. */
export const isLook = (raw: unknown): raw is Look => {
  if (typeof raw !== "object" || raw === null) return false;
  const keys = Object.keys(raw);
  return (
    keys.length === LOOK_PARTS.length &&
    LOOK_PARTS.every((part) => lookInRange(part, (raw as Record<string, unknown>)[part]))
  );
};

/** "body.eyes.outfit.hair.accessory", e.g. "3.1.20.45.-1": the form kept in the database and room state. */
export const encodeLook = (look: Look): string => LOOK_PARTS.map((part) => look[part]).join(".");

/** Undefined when the text is not a valid look (so bad data never reaches the renderer). */
export function decodeLook(text: string): Look | undefined {
  const values = text.split(".");
  if (values.length !== LOOK_PARTS.length) return undefined;
  const look: Record<string, number> = {};
  for (const [i, part] of LOOK_PARTS.entries()) {
    const raw = values[i]!;
    if (!/^-?\d{1,3}$/.test(raw)) return undefined;
    look[part] = Number(raw);
  }
  return isLook(look) ? look : undefined;
}

// Collision. One implementation for both sides, so what the client allows the server allows too.
export interface CollisionGrid {
  tileSize: number;
  cols: number;
  rows: number;
  /** Row-major, cols * rows. */
  blocked: boolean[];
}

export function createGrid(
  cols: number,
  rows: number,
  tileSize: number,
  isBlocked: (col: number, row: number) => boolean,
): CollisionGrid {
  const blocked: boolean[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) blocked.push(isBlocked(col, row));
  }
  return { tileSize, cols, rows, blocked };
}

function tileBlocked(grid: CollisionGrid, col: number, row: number): boolean {
  // Outside the map counts as solid so players can never leave it.
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return true;
  return grid.blocked[row * grid.cols + col]!;
}

/** True if a circle at (x, y) overlaps any blocked tile. */
export function collidesCircle(grid: CollisionGrid, x: number, y: number, radius: number): boolean {
  const { tileSize } = grid;
  const minCol = Math.floor((x - radius) / tileSize);
  const maxCol = Math.floor((x + radius) / tileSize);
  const minRow = Math.floor((y - radius) / tileSize);
  const maxRow = Math.floor((y + radius) / tileSize);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!tileBlocked(grid, col, row)) continue;
      const nearestX = Math.max(col * tileSize, Math.min(x, (col + 1) * tileSize));
      const nearestY = Math.max(row * tileSize, Math.min(y, (row + 1) * tileSize));
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

// Players closer than this (in tiles) hear and see each other.
export const PROXIMITY_TILES = 3;
export const PROXIMITY_RADIUS = PROXIMITY_TILES * TILE_SIZE;

export const MESSAGES = {
  MOVE: "move",
  // Request/response: the room answers with a VoiceToken.
  VOICE_TOKEN: "voice-token",
  // After an account edit over HTTP: the room re-reads the name and look from the database.
  REFRESH_PROFILE: "refresh-profile",
  // Server to client: a move was refused, so the client puts the player back where the server has them.
  SNAP: "snap",
  // Request/response: claim one table by id, or give up the one you hold. A refusal rejects.
  CLAIM_TABLE: "claim-table",
  UNCLAIM_TABLE: "unclaim-table",
  // Client to server: wave at a nearby player. Server to both of them: the wave happened.
  WAVE: "wave",
  WAVED: "waved",
} as const;

export interface VoiceToken {
  url: string;
  token: string;
}

export interface Position {
  x: number;
  y: number;
}

export type MovePayload = Position;

// Waving. You can wave at someone within WAVE_RANGE. Spamming is allowed; the short gap (20 a
// second) only stops a client from flooding the room.
export const WAVE_RANGE = 4 * TILE_SIZE;
export const WAVE_COOLDOWN_MS = 50;

export interface WavePayload {
  /** Session id of the player being waved at. */
  targetId: string;
}

export interface WavedPayload {
  fromId: string;
  toId: string;
  /** The waver's name, for the toast. */
  name: string;
}

// Tables. Desks are objects on the map's "tables" layer (generated with the map); each user may
// claim one per space. Claims live in the database and in room state, keyed by table id.
export const TABLES_LAYER = "tables";
// How far outside a table's rectangle you may stand and still claim it. 0: you must be inside it.
export const CLAIM_RANGE_TILES = 0;

/** A claimable desk: a rectangle in world pixels. */
export interface MapTable {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClaimTablePayload {
  tableId: string;
}

/** Distance from a point to the nearest edge of a table (0 inside it). */
export const distanceToTable = (table: MapTable, pos: Position): number =>
  Math.hypot(
    Math.max(table.x - pos.x, 0, pos.x - (table.x + table.width)),
    Math.max(table.y - pos.y, 0, pos.y - (table.y + table.height)),
  );

/** The closest table within claiming range, if any. */
export function tableInRange(tables: readonly MapTable[], pos: Position): MapTable | undefined {
  const range = CLAIM_RANGE_TILES * TILE_SIZE;
  let best: MapTable | undefined;
  let bestDistance = Infinity;
  for (const table of tables) {
    const d = distanceToTable(table, pos);
    if (d <= range && d < bestDistance) {
      best = table;
      bestDistance = d;
    }
  }
  return best;
}

// Accounts. Email and password live on the server; the client only ever holds a signed token.
export const MIN_PASSWORD_LENGTH = 10;
// scrypt cost grows with input size, so cap it to keep a login request cheap to reject.
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 254;

export const AUTH_ROUTES = {
  REGISTER: "/auth/register",
  LOGIN: "/auth/login",
  // GET reads the profile, PATCH edits it, DELETE closes the account.
  ME: "/auth/me",
  PASSWORD: "/auth/password",
  EMAIL: "/auth/email",
  SIGN_OUT_OTHERS: "/auth/sign-out-others",
} as const;

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  look: Look;
}

export type UpdateProfilePayload = Pick<RegisterPayload, "name" | "look">;

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ChangeEmailPayload {
  currentPassword: string;
  email: string;
}

export interface DeleteAccountPayload {
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  name: string;
  look: Look;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

export interface ApiError {
  error: string;
}

/** Colyseus join options. Identity comes from the token, never from a client-sent name. */
export interface JoinOptions {
  token: string;
  spaceId: string;
}

// Spaces. A space is its own room with its own members; the role decides what a member may do.
export const SPACE_ROLES = ["owner", "admin", "member"] as const;
export type SpaceRole = (typeof SPACE_ROLES)[number];
export const MAX_SPACE_NAME_LENGTH = 40;
// Stops one account from filling the database with rooms.
export const MAX_OWNED_SPACES = 5;
// Only the office exists so far; the template picks the map a new space starts from.
export const SPACE_TEMPLATES = ["office"] as const;
export type SpaceTemplate = (typeof SPACE_TEMPLATES)[number];

export const SPACE_ROUTES = {
  // GET lists the spaces you belong to, POST creates one.
  LIST: "/spaces",
  // Append /:id/members to read a space's members.
  PREFIX: "/spaces/",
} as const;

/** Owners and admins may invite people and decide on join requests. */
export const canManageMembers = (role: SpaceRole) => role === "owner" || role === "admin";

// Invite links. The token is shown once when the link is made; the server keeps only a hash.
export const INVITE_ROUTES = {
  // GET previews an invite, POST on /:token/accept uses it.
  PREFIX: "/invites/",
} as const;
export const MAX_ACTIVE_INVITES = 20;
export const MAX_INVITE_HOURS = 24 * 90;

export interface InviteOptions {
  requiresApproval: boolean;
  /** Hours until the link stops working, or null for a link that does not expire. */
  expiresInHours: number | null;
}

export interface InviteSummary {
  id: string;
  requiresApproval: boolean;
  expiresAt: string | null;
  createdAt: string;
  createdByName: string;
}

export interface CreatedInvite extends InviteSummary {
  token: string;
}

export interface InvitePreview {
  spaceName: string;
  requiresApproval: boolean;
  alreadyMember: boolean;
}

export type InviteResult =
  { status: "joined"; space: SpaceSummary } | { status: "pending"; spaceName: string };

export interface JoinRequest {
  userId: string;
  name: string;
  look: Look;
  createdAt: string;
}

export interface SpaceSummary {
  id: string;
  name: string;
  role: SpaceRole;
  template: SpaceTemplate;
}

export interface CreateSpacePayload {
  name: string;
}

export interface SpaceMember {
  userId: string;
  name: string;
  look: Look;
  role: SpaceRole;
}

// Desktop shell bridge. The Electron preload exposes DesktopBridge as `window.voidDesktop`;
// the browser build has no such object, so the client must treat it as optional.
export const DESKTOP_IPC = {
  LIST_SCREENS: "screen:list",
  SELECT_SCREEN: "screen:select",
  OPEN_SCREEN_SETTINGS: "screen:open-settings",
} as const;

export interface ScreenSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  /** PNG data URL. */
  thumbnail: string;
}

export interface ScreenSourceList {
  sources: ScreenSource[];
  /** macOS blocks capture until Screen Recording is allowed in System Settings. */
  needsPermission: boolean;
}

export interface DesktopBridge {
  listScreenSources(): Promise<ScreenSourceList>;
  /** Must be called with an id from the latest list, right before getDisplayMedia. */
  selectScreenSource(id: string): Promise<void>;
  openScreenSettings(): Promise<void>;
}
