import type { Position } from "@void/shared";

export interface Direction {
  dx: number;
  dy: number;
}

/** Advance a position one frame. Diagonals are normalised so they are not faster. */
export function stepPosition(
  pos: Position,
  dir: Direction,
  speed: number,
  deltaMs: number,
): Position {
  const len = Math.hypot(dir.dx, dir.dy);
  if (len === 0) return pos;
  const distance = speed * (deltaMs / 1000);
  return {
    x: pos.x + (dir.dx / len) * distance,
    y: pos.y + (dir.dy / len) * distance,
  };
}
