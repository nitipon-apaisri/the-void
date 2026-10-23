export const ROOM_NAME = "void";
export const MAX_CLIENTS = 100;
export const MAX_NAME_LENGTH = 24;

// World. Must match client/src/assets/maps/office.tmj (client/src/test/map.spec.ts checks it).
export const TILE_SIZE = 32;
export const MAP_COLS = 40;
export const MAP_ROWS = 30;
export const WORLD_WIDTH = MAP_COLS * TILE_SIZE;
export const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;
export const SPAWN = { x: 10 * TILE_SIZE + TILE_SIZE / 2, y: 20 * TILE_SIZE + TILE_SIZE / 2 };

// Avatar choices; players send an index 0..AVATAR_COUNT-1. The client maps it to a premade
// character sheet (client/src/utils/characters.ts); 4c replaces this with layered parts.
export const AVATAR_COUNT = 10;

// Players closer than this (in tiles) hear and see each other.
export const PROXIMITY_TILES = 3;
export const PROXIMITY_RADIUS = PROXIMITY_TILES * TILE_SIZE;

export const MESSAGES = {
  MOVE: "move",
  // Request/response: the room answers with a VoiceToken.
  VOICE_TOKEN: "voice-token",
  // After an account edit over HTTP: the room re-reads the name and avatar from the database.
  REFRESH_PROFILE: "refresh-profile",
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
  avatar: number;
}

export type UpdateProfilePayload = Pick<RegisterPayload, "name" | "avatar">;

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
  avatar: number;
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
