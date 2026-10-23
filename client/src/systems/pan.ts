import type { Position } from "@void/shared";

/** How far a held pointer must travel before it counts as a drag rather than a click. */
export const DRAG_THRESHOLD = 6;

export const isDrag = (start: Position, now: Position) =>
  Math.hypot(now.x - start.x, now.y - start.y) > DRAG_THRESHOLD;

/** Dragging the map right moves the view left, and a bigger zoom moves it less per pixel. */
export const panBy = (scroll: Position, delta: Position, zoom: number): Position => ({
  x: scroll.x - delta.x / zoom,
  y: scroll.y - delta.y / zoom,
});

/**
 * The view centre that keeps the world point under the pointer where it is while zooming.
 * `offset` is the pointer's distance from the middle of the screen.
 */
export const anchorCenter = (
  center: Position,
  offset: Position,
  oldZoom: number,
  newZoom: number,
): Position => ({
  x: center.x + offset.x * (1 / oldZoom - 1 / newZoom),
  y: center.y + offset.y * (1 / oldZoom - 1 / newZoom),
});
