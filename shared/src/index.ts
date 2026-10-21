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

export const MESSAGES = {
  MOVE: "move",
} as const;

export interface Position {
  x: number;
  y: number;
}

export type MovePayload = Position;

export interface JoinOptions {
  name?: string;
  avatar?: number;
}
