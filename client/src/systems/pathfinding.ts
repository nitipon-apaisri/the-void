// shared
import type { Position } from "@void/shared";

// systems
import { collidesCircle, type CollisionGrid } from "./collision";

const SIGHT_STEP = 4;
// How far from a blocked click to look for somewhere to stand, in tiles.
const NEAREST_TILES = 3;

interface Node {
  col: number;
  row: number;
  g: number;
  f: number;
  parent?: Node;
}

const blockedAt = (grid: CollisionGrid, col: number, row: number) =>
  col < 0 ||
  row < 0 ||
  col >= grid.cols ||
  row >= grid.rows ||
  grid.blocked[row * grid.cols + col]!;

const centre = (grid: CollisionGrid, col: number, row: number): Position => ({
  x: (col + 0.5) * grid.tileSize,
  y: (row + 0.5) * grid.tileSize,
});

/** True when a circle can travel the straight line from a to b without touching anything. */
function clearLine(grid: CollisionGrid, a: Position, b: Position, radius: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SIGHT_STEP));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (collidesCircle(grid, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, radius)) return false;
  }
  return true;
}

/** The free tile nearest to (col, row), looking outward ring by ring; undefined if none is close. */
function nearestFree(grid: CollisionGrid, col: number, row: number) {
  if (!blockedAt(grid, col, row)) return { col, row };
  let best: { col: number; row: number } | undefined;
  let bestDistance = Infinity;
  for (let dr = -NEAREST_TILES; dr <= NEAREST_TILES; dr++) {
    for (let dc = -NEAREST_TILES; dc <= NEAREST_TILES; dc++) {
      if (blockedAt(grid, col + dc, row + dr)) continue;
      const distance = dc * dc + dr * dr;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { col: col + dc, row: row + dr };
      }
    }
  }
  return best;
}

/**
 * A route from `from` to `to` around blocked tiles, as waypoints to walk to in order (the start
 * is not included). Empty when there is nowhere to go. If `to` is inside a wall the route ends
 * at the nearest free tile instead.
 */
export function findPath(
  grid: CollisionGrid,
  from: Position,
  to: Position,
  radius: number,
): Position[] {
  const { tileSize } = grid;
  const start = { col: Math.floor(from.x / tileSize), row: Math.floor(from.y / tileSize) };
  const goal = nearestFree(grid, Math.floor(to.x / tileSize), Math.floor(to.y / tileSize));
  if (!goal) return [];

  // The exact click is used when a circle fits there; otherwise the tile's centre.
  const exact = !collidesCircle(grid, to.x, to.y, radius);
  const target = exact ? to : centre(grid, goal.col, goal.row);

  // A straight walk needs no search.
  if (clearLine(grid, from, target, radius)) return [target];

  const key = (col: number, row: number) => row * grid.cols + col;
  const heuristic = (col: number, row: number) => {
    const dx = Math.abs(col - goal.col);
    const dy = Math.abs(row - goal.row);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const open: Node[] = [{ ...start, g: 0, f: heuristic(start.col, start.row) }];
  const best = new Map<number, number>([[key(start.col, start.row), 0]]);
  const closed = new Set<number>();
  let end: Node | undefined;

  while (open.length > 0) {
    let at = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[at]!.f) at = i;
    const node = open.splice(at, 1)[0]!;
    const id = key(node.col, node.row);
    if (closed.has(id)) continue;
    closed.add(id);
    if (node.col === goal.col && node.row === goal.row) {
      end = node;
      break;
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dc === 0 && dr === 0) continue;
        const col = node.col + dc;
        const row = node.row + dr;
        if (blockedAt(grid, col, row)) continue;
        // No cutting a corner: a diagonal step needs both tiles beside it free.
        if (
          dc !== 0 &&
          dr !== 0 &&
          (blockedAt(grid, node.col + dc, node.row) || blockedAt(grid, node.col, node.row + dr))
        ) {
          continue;
        }
        const g = node.g + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
        const next = key(col, row);
        if (g >= (best.get(next) ?? Infinity)) continue;
        best.set(next, g);
        open.push({ col, row, g, f: g + heuristic(col, row), parent: node });
      }
    }
  }
  if (!end) return [];

  const tiles: Position[] = [];
  for (let node: Node | undefined = end; node; node = node.parent) {
    tiles.push(centre(grid, node.col, node.row));
  }
  tiles.reverse();
  tiles[tiles.length - 1] = target;

  // Pull the route tight: from each point, skip to the furthest waypoint still in clear sight.
  const route: Position[] = [];
  let anchor = from;
  let i = 1;
  while (i < tiles.length) {
    let far = i;
    for (let j = tiles.length - 1; j > i; j--) {
      if (clearLine(grid, anchor, tiles[j]!, radius)) {
        far = j;
        break;
      }
    }
    anchor = tiles[far]!;
    route.push(anchor);
    i = far + 1;
  }
  return route;
}

/**
 * Walks `distance` along a route from `pos`. Returns the direction to head now and the
 * waypoints left; waypoints reached this frame are dropped. No direction when the route is done.
 */
export function followPath(
  path: readonly Position[],
  pos: Position,
  distance: number,
): { dx: number; dy: number; rest: Position[] } {
  let rest = [...path];
  while (rest.length > 0 && Math.hypot(rest[0]!.x - pos.x, rest[0]!.y - pos.y) <= distance) {
    rest = rest.slice(1);
  }
  const next = rest[0];
  if (!next) return { dx: 0, dy: 0, rest };
  return { dx: next.x - pos.x, dy: next.y - pos.y, rest };
}
