// shared
import { SPAWN, WORLD_HEIGHT, WORLD_WIDTH, type Position } from "@void/shared";

/**
 * Where a player appears: where they last stood if that is still inside the world,
 * otherwise the default spawn. The saved value came from us, but the map may have changed.
 */
export function resolveSpawn(lastX: number | null, lastY: number | null): Position {
  if (
    typeof lastX === "number" &&
    typeof lastY === "number" &&
    Number.isFinite(lastX) &&
    Number.isFinite(lastY) &&
    lastX >= 0 &&
    lastX <= WORLD_WIDTH &&
    lastY >= 0 &&
    lastY <= WORLD_HEIGHT
  ) {
    return { x: lastX, y: lastY };
  }
  return { x: SPAWN.x, y: SPAWN.y };
}
