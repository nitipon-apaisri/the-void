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
