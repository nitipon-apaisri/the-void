// shared
import {
  collidesCircle,
  findSpawn,
  PLAYER_RADIUS,
  type CollisionGrid,
  type Position,
} from "@void/shared";

/**
 * Where a player appears: where they last stood if that is still open floor, otherwise the
 * spawn nearest the middle of the map. The saved value came from us, but the map may have
 * changed since.
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
    lastX <= grid.cols * grid.tileSize &&
    lastY >= 0 &&
    lastY <= grid.rows * grid.tileSize &&
    !collidesCircle(grid, lastX, lastY, PLAYER_RADIUS)
  ) {
    return { x: lastX, y: lastY };
  }
  return findSpawn(grid, PLAYER_RADIUS);
}
