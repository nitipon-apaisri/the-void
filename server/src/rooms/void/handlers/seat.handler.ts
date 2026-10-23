// shared
import {
  collidesCircle,
  PLAYER_RADIUS,
  standCandidates,
  type CollisionGrid,
  type Position,
  type Seat,
  type SitPayload,
} from "@void/shared";

/** The payload of a sit request, or null if it is not one. */
export function parseSit(payload: unknown): SitPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { seatId } = payload as { seatId?: unknown };
  return typeof seatId === "string" && seatId.length > 0 && seatId.length <= 64 ? { seatId } : null;
}

/** Where someone who leaves `seat` stands: the first open spot, else where they sat down. */
export function pickStandSpot(grid: CollisionGrid, seat: Seat, before: Position): Position {
  return (
    standCandidates(seat, before).find((s) => !collidesCircle(grid, s.x, s.y, PLAYER_RADIUS)) ??
    before
  );
}
