// Frame layout of the LimeZu character sheets (32 x 64 frames, 56 per row). Each state is one
// row holding 6 frames per direction, in the order right, up, left, down.
export const FRAME = { width: 32, height: 64, columns: 56 } as const;

export const FACINGS = ["right", "up", "left", "down"] as const;
export type Facing = (typeof FACINGS)[number];
export type CharacterState = "idle" | "walk" | "sit";

const ROW = { idle: 1, walk: 2 } as const;
// Sitting poses exist only for right, left (row 4, 6 frames each) and down (row 5). A chair
// that faces up has no pose of its own, so it falls back to the standing back view.
const SIT: Partial<Record<Facing, { row: number; col: number }>> = {
  right: { row: 4, col: 0 },
  left: { row: 4, col: 6 },
  down: { row: 5, col: 0 },
};
const FRAMES_PER_DIRECTION = 6;

/** First and last frame index of a state facing a direction. */
export function frameRange(state: CharacterState, facing: Facing): { start: number; end: number } {
  if (state === "sit") {
    const pose = SIT[facing];
    if (!pose) return frameRange("idle", facing);
    const first = pose.row * FRAME.columns + pose.col;
    return { start: first, end: first + FRAMES_PER_DIRECTION - 1 };
  }
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
