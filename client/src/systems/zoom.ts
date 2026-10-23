import { ZOOM_LEVELS } from "./settings";

/** The next zoom level up (1) or down (-1), staying inside the allowed levels. */
export function stepZoom(current: number, direction: 1 | -1): number {
  // Snap to the nearest allowed level first, so an odd saved value still steps sensibly.
  let nearest = 0;
  ZOOM_LEVELS.forEach((level, i) => {
    if (Math.abs(level - current) < Math.abs(ZOOM_LEVELS[nearest] - current)) nearest = i;
  });
  const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, nearest + direction));
  return ZOOM_LEVELS[next];
}

export const ZOOM_MIN = ZOOM_LEVELS[0];
export const ZOOM_MAX = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

// A trackpad pinch sends small deltas and a mouse wheel big ones; capping each event keeps both smooth.
const MAX_WHEEL_DELTA = 25;
const WHEEL_SENSITIVITY = 0.01;

/** Continuous zoom from a pinch or Cmd/Ctrl + wheel: spreading fingers (negative delta) zooms in. */
export function zoomByWheel(current: number, deltaY: number): number {
  const delta = Math.max(-MAX_WHEEL_DELTA, Math.min(MAX_WHEEL_DELTA, deltaY));
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * Math.exp(-delta * WHEEL_SENSITIVITY)));
}

/**
 * The smallest zoom at which the map still fills the window, so no empty border shows when the
 * window is bigger than the map. The chosen zoom is used when it is already larger.
 */
export const effectiveZoom = (
  chosen: number,
  view: { width: number; height: number },
  map: { width: number; height: number },
) => Math.max(chosen, view.width / map.width, view.height / map.height);
