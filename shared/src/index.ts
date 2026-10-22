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

// Avatar choices; players send an index into this list.
export const AVATAR_COLORS = [0x6ee7b7, 0x93c5fd, 0xfca5a5, 0xfcd34d, 0xc4b5fd, 0xf9a8d4] as const;

// Players closer than this (in tiles) hear and see each other.
export const PROXIMITY_TILES = 3;
export const PROXIMITY_RADIUS = PROXIMITY_TILES * TILE_SIZE;

export const MESSAGES = {
  MOVE: "move",
  // Request/response: the room answers with a VoiceToken.
  VOICE_TOKEN: "voice-token",
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
  ME: "/auth/me",
} as const;

export interface UserProfile {
  id: string;
  name: string;
  avatar: number;
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
