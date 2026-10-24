// lib
import { Client } from "@colyseus/sdk";

// shared
import {
  MESSAGES,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  ROOM_NAME,
  collidesCircle,
  type CollisionGrid,
  type JoinOptions,
  type Position,
} from "@void/shared";

// systems
import { findPath, followPath } from "../../client/src/systems/pathfinding.js";
import { LOAD_SPACE_ID } from "./config.js";

export interface BotResult {
  connected: boolean;
  /** The server put this bot back (a wall or too fast): the bot walks the same rules as a player. */
  snaps: number;
  /** The connection ended before the run did. */
  dropped: boolean;
  error?: string;
}

/** A random spot a person could stand on. */
function randomSpot(grid: CollisionGrid): Position {
  for (;;) {
    const x = Math.random() * grid.cols * grid.tileSize;
    const y = Math.random() * grid.rows * grid.tileSize;
    if (!collidesCircle(grid, x, y, PLAYER_RADIUS)) return { x, y };
  }
}

/**
 * Joins like the client does and then walks to random spots at walking speed, sending its
 * position at the client's rate. Resolves when `signal` aborts.
 */
export async function runBot(
  url: string,
  name: string,
  grid: CollisionGrid,
  sendHz: number,
  signal: AbortSignal,
): Promise<BotResult> {
  const result: BotResult = { connected: false, snaps: 0, dropped: false };
  let room;
  try {
    const options: JoinOptions = { token: name, spaceId: LOAD_SPACE_ID };
    room = await new Client(url).joinOrCreate(ROOM_NAME, options);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
  result.connected = true;

  let pos: Position | undefined;
  let route: Position[] = [];
  room.onMessage(MESSAGES.SNAP, (to: Position) => {
    result.snaps++;
    pos = { x: to.x, y: to.y };
    route = [];
  });
  room.onLeave(() => {
    if (!signal.aborted) result.dropped = true;
  });

  const stepMs = 1000 / sendHz;
  const timer = setInterval(() => {
    // The first state patch carries where the server put us.
    const me = (room.state as { players?: Map<string, Position> }).players?.get(room.sessionId);
    if (!pos && me) pos = { x: me.x, y: me.y };
    if (!pos) return;
    if (route.length === 0) {
      route = findPath(grid, pos, randomSpot(grid), PLAYER_RADIUS);
      return;
    }
    const { dx, dy, rest } = followPath(route, pos, (PLAYER_SPEED * stepMs) / 1000);
    route = rest;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const step = Math.min(length, (PLAYER_SPEED * stepMs) / 1000);
    pos = { x: pos.x + (dx / length) * step, y: pos.y + (dy / length) * step };
    room.send(MESSAGES.MOVE, pos);
  }, stepMs);

  await new Promise<void>((resolve) => {
    if (signal.aborted) resolve();
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
  clearInterval(timer);
  await room.leave().catch(() => {});
  return result;
}
