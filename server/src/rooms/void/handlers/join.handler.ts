// shared
import {
  collidesCircle,
  PLAYER_RADIUS,
  SPAWN,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type CollisionGrid,
  type Position,
} from "@void/shared";

/**
 * Where a player appears: where they last stood if that is still open floor, otherwise the
 * default spawn. The saved value came from us, but the map may have changed since.
 */
export function resolveSpawn(
  lastX: number | null,
  lastY: number | null,
  grid: CollisionGrid,
): Position {
  if (
    typeof lastX === "number" &&
    typeof lastY === "number" &&
    Number.isFinite(lastX) &&
    Number.isFinite(lastY) &&
    lastX >= 0 &&
    lastX <= WORLD_WIDTH &&
    lastY >= 0 &&
    lastY <= WORLD_HEIGHT &&
    !collidesCircle(grid, lastX, lastY, PLAYER_RADIUS)
  ) {
    return { x: lastX, y: lastY };
  }
  return { x: SPAWN.x, y: SPAWN.y };
}
