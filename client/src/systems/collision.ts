// shared
import { collidesCircle, createGrid, type CollisionGrid, type Position } from "@void/shared";

// The grid and the overlap test are shared with the server, which enforces the same walls.
export { collidesCircle, createGrid, type CollisionGrid };

/** Moves from `from` toward `to`, one axis at a time, so players slide along walls. */
export function moveWithCollision(
  grid: CollisionGrid,
  from: Position,
  to: Position,
  radius: number,
): Position {
  let { x, y } = from;
  if (!collidesCircle(grid, to.x, y, radius)) x = to.x;
  if (!collidesCircle(grid, x, to.y, radius)) y = to.y;
  return { x, y };
}
