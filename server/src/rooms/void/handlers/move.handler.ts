// shared
import {
  collidesCircle,
  PLAYER_RADIUS,
  PLAYER_RUN_SPEED,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type CollisionGrid,
  type MovePayload,
  type Position,
} from "@void/shared";

/** Returns a clean position, or null if the client sent something we should ignore. */
export function parseMove(payload: unknown): MovePayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { x, y } = payload as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || x > WORLD_WIDTH || y < 0 || y > WORLD_HEIGHT) return null;
  return { x, y };
}

// A little over the fastest speed (running to a person), so a late frame or a bunched-up packet is not mistaken for cheating.
const SPEED_ALLOWANCE = 1.25;
const BUDGET_SECONDS = 1;

/**
 * How far a player may travel, as a bucket that refills at running speed. Counting distance
 * rather than checking each step means sending moves faster gains nothing, and a delayed
 * packet that carries a longer step still passes.
 */
export class MoveBudget {
  private readonly max = PLAYER_RUN_SPEED * SPEED_ALLOWANCE * BUDGET_SECONDS;
  private budget = this.max;
  private last: number;

  constructor(now: number) {
    this.last = now;
  }

  /** True and spent if the distance is affordable; false leaves the budget as it was. */
  spend(distance: number, now: number): boolean {
    const elapsed = Math.max(0, now - this.last) / 1000;
    this.last = now;
    this.budget = Math.min(this.max, this.budget + PLAYER_RUN_SPEED * SPEED_ALLOWANCE * elapsed);
    if (distance > this.budget) return false;
    this.budget -= distance;
    return true;
  }
}

/** True if the player may stand at `to`: not inside a wall, and not further than they can walk. */
export function acceptMove(
  grid: CollisionGrid,
  budget: MoveBudget,
  from: Position,
  to: Position,
  now: number,
): boolean {
  if (collidesCircle(grid, to.x, to.y, PLAYER_RADIUS)) return false;
  return budget.spend(Math.hypot(to.x - from.x, to.y - from.y), now);
}
