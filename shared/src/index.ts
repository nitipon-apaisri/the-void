export const ROOM_NAME = "void";
export const MAX_CLIENTS = 100;
export const MAX_NAME_LENGTH = 24;
// Sanity limit for client-reported coordinates until the real map bounds exist.
export const MAX_COORDINATE = 10_000;

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
}
