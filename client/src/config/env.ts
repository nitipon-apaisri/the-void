// shared
import { PROXIMITY_TILES, TILE_SIZE } from "@void/shared";

export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";
// The HTTP API shares the game server's address; only the scheme differs.
export const API_URL = SERVER_URL.replace(/^ws/, "http");

export const PLAYER_SPEED = 180;
export const PLAYER_RADIUS = 12;
// ~12 Hz position updates; remote players tween over REMOTE_TWEEN_MS to smooth them.
export const MOVE_SEND_INTERVAL_MS = 80;
export const REMOTE_TWEEN_MS = 100;
export const CONNECT_RETRY_MS = 3000;
// How often to recompute who is within hearing range; players move slowly enough for 4 Hz.
export const PROXIMITY_CHECK_MS = 250;
// Screen shares are heavy; a viewer receives at most this many at once (nearest first).
export const MAX_SCREEN_SHARES = 1;

// Hearing and seeing range in tiles. Only the client uses it, so it is a VITE_ setting;
// anything that is not a positive number falls back to the shared default.
const configuredTiles = Number(import.meta.env.VITE_PROXIMITY_TILES);
export const PROXIMITY_RADIUS =
  (configuredTiles > 0 && Number.isFinite(configuredTiles) ? configuredTiles : PROXIMITY_TILES) *
  TILE_SIZE;
