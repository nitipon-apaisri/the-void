import type { Position } from "@void/shared";

export interface CollisionGrid {
  tileSize: number;
  cols: number;
  rows: number;
  /** Row-major, cols * rows. */
  blocked: boolean[];
}

export function createGrid(
  cols: number,
  rows: number,
  tileSize: number,
  isBlocked: (col: number, row: number) => boolean,
): CollisionGrid {
  const blocked: boolean[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) blocked.push(isBlocked(col, row));
  }
  return { tileSize, cols, rows, blocked };
}

function tileBlocked(grid: CollisionGrid, col: number, row: number): boolean {
  // Outside the map counts as solid so players can never leave it.
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return true;
  return grid.blocked[row * grid.cols + col];
}

/** True if a circle at (x, y) overlaps any blocked tile. */
export function collidesCircle(grid: CollisionGrid, x: number, y: number, radius: number): boolean {
  const { tileSize } = grid;
  const minCol = Math.floor((x - radius) / tileSize);
  const maxCol = Math.floor((x + radius) / tileSize);
  const minRow = Math.floor((y - radius) / tileSize);
  const maxRow = Math.floor((y + radius) / tileSize);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!tileBlocked(grid, col, row)) continue;
      const nearestX = Math.max(col * tileSize, Math.min(x, (col + 1) * tileSize));
      const nearestY = Math.max(row * tileSize, Math.min(y, (row + 1) * tileSize));
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

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
