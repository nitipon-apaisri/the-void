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

/**
 * Turns a stream of wheel deltas into zoom steps. A trackpad pinch sends many tiny deltas and a
 * mouse wheel a few big ones; collecting them until `threshold` makes both feel like one step.
 */
export function createWheelStepper(threshold: number) {
  let sum = 0;
  return (deltaY: number): 1 | -1 | 0 => {
    sum += deltaY;
    if (Math.abs(sum) < threshold) return 0;
    const direction = sum < 0 ? 1 : -1; // spreading fingers (negative delta) zooms in
    sum = 0;
    return direction;
  };
}
