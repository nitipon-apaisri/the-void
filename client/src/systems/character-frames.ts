// Frame layout of the LimeZu character sheets (32 x 64 frames, 56 per row). Each state is one
// row holding 6 frames per direction, in the order right, up, left, down.
export const FRAME = { width: 32, height: 64, columns: 56 } as const;

export const FACINGS = ["right", "up", "left", "down"] as const;
export type Facing = (typeof FACINGS)[number];
export type CharacterState = "idle" | "walk";

const ROW: Record<CharacterState, number> = { idle: 1, walk: 2 };
const FRAMES_PER_DIRECTION = 6;

/** First and last frame index of a state facing a direction. */
export function frameRange(state: CharacterState, facing: Facing): { start: number; end: number } {
  const start = ROW[state] * FRAME.columns + FACINGS.indexOf(facing) * FRAMES_PER_DIRECTION;
  return { start, end: start + FRAMES_PER_DIRECTION - 1 };
}

/** The way a step points. The longer axis wins; no movement keeps the current facing. */
export function facingFor(dx: number, dy: number, current: Facing): Facing {
  if (dx === 0 && dy === 0) return current;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? "down" : "up";
  // A perfect diagonal: keep facing if it is one of the two options, else take the horizontal.
  const horizontal: Facing = dx > 0 ? "right" : "left";
  const vertical: Facing = dy > 0 ? "down" : "up";
  return current === vertical ? vertical : horizontal;
}
