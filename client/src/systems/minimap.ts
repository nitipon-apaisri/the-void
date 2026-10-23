import type { Position } from "@void/shared";

export interface MinimapScale {
  /** Screen pixels per world pixel. */
  factor: number;
  width: number;
  height: number;
}

/** A mini map as wide as `width` pixels, with the world's proportions. */
export function minimapScale(
  world: { width: number; height: number },
  width: number,
): MinimapScale {
  const factor = width / world.width;
  return { factor, width, height: Math.round(world.height * factor) };
}

export const toMinimap = (pos: Position, scale: MinimapScale): Position => ({
  x: pos.x * scale.factor,
  y: pos.y * scale.factor,
});

/** The world position under a point on the mini map, kept inside the world. */
export function fromMinimap(
  point: Position,
  scale: MinimapScale,
  world: { width: number; height: number },
): Position {
  return {
    x: Math.min(world.width, Math.max(0, point.x / scale.factor)),
    y: Math.min(world.height, Math.max(0, point.y / scale.factor)),
  };
}
