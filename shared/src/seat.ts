import { findFurniture, type PlacedFurniture } from "./furniture.js";

// Sitting. A seat is a point and the way you face when you sit there. Seats come from the map's
// "seats" layer (desk and meeting chairs) and from placed chairs. The room snaps you to the seat
// and keeps you there until you stand up.

export const SEATS_LAYER = "seats";
// How close you must be to the seat's centre. Same as TILE_SIZE * 1.6: the next tile, diagonals too.
export const SIT_RANGE = 52;
const TILE = 32;

export type SeatFacing = "up" | "down" | "left" | "right";
export const SEAT_FACINGS: readonly SeatFacing[] = ["up", "down", "left", "right"];

export interface Seat {
  id: string;
  x: number;
  y: number;
  facing: SeatFacing;
  /** Set for a chair the client draws itself (a desk chair, lifted so it tucks under the desk). */
  art?: string;
}

export const isSeatFacing = (v: unknown): v is SeatFacing =>
  typeof v === "string" && (SEAT_FACINGS as readonly string[]).includes(v);

export interface SitPayload {
  seatId: string;
}

/** The seats that placed furniture brings (a chair), with ids that follow the piece's id. */
export function furnitureSeats(pieces: Iterable<PlacedFurniture>): Seat[] {
  const seats: Seat[] = [];
  for (const piece of pieces) {
    const seat = findFurniture(piece.itemId)?.seat;
    if (!seat) continue;
    seats.push({
      id: `f${piece.id}`,
      x: piece.col * TILE + seat.x,
      y: piece.row * TILE + seat.y,
      facing: seat.facing,
    });
  }
  return seats;
}

const OPPOSITE: Record<SeatFacing, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};

/** The free seat nearest to `pos` within reach, if any. */
export function nearestFreeSeat(
  seats: readonly Seat[],
  taken: ReadonlySet<string>,
  pos: { x: number; y: number },
): Seat | undefined {
  let best: Seat | undefined;
  let bestDistance = Infinity;
  for (const seat of seats) {
    if (taken.has(seat.id)) continue;
    const d = Math.hypot(seat.x - pos.x, seat.y - pos.y);
    if (d <= SIT_RANGE && d < bestDistance) {
      best = seat;
      bestDistance = d;
    }
  }
  return best;
}

/** Where to put someone who stands up, best first: where they sat down, then out from the seat. */
export function standCandidates(seat: Seat, before: { x: number; y: number }) {
  const back = OPPOSITE[seat.facing];
  const spots = [before, { x: seat.x + back.x * TILE, y: seat.y + back.y * TILE }];
  for (const f of SEAT_FACINGS) {
    const d = OPPOSITE[f];
    spots.push({ x: seat.x + d.x * TILE, y: seat.y + d.y * TILE });
  }
  return spots;
}
