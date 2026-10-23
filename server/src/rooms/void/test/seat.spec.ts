import { describe, expect, it } from "vitest";
import { createGrid, furnitureSeats, nearestFreeSeat, SIT_RANGE, type Seat } from "@void/shared";

import { parseSeats } from "../../../services/map.service.js";
import { parseSit, pickStandSpot } from "../handlers/seat.handler.js";

const seat = (id: string, x: number, y: number, facing: Seat["facing"] = "up"): Seat => ({
  id,
  x,
  y,
  facing,
});

describe("parseSit", () => {
  it("accepts a seat id and drops anything else", () => {
    expect(parseSit({ seatId: "s5", extra: 1 })).toEqual({ seatId: "s5" });
  });

  it.each([null, 5, {}, { seatId: 3 }, { seatId: "" }, { seatId: "x".repeat(99) }])(
    "rejects %j",
    (payload) => {
      expect(parseSit(payload)).toBeNull();
    },
  );
});

describe("nearestFreeSeat", () => {
  const seats = [seat("a", 100, 100), seat("b", 100 + SIT_RANGE - 1, 100)];

  it("picks the nearest free seat in reach", () => {
    expect(nearestFreeSeat(seats, new Set(), { x: 100, y: 100 })?.id).toBe("a");
    expect(nearestFreeSeat(seats, new Set(["a"]), { x: 100, y: 100 })?.id).toBe("b");
  });

  it("finds nothing out of reach or when all are taken", () => {
    expect(nearestFreeSeat(seats, new Set(), { x: 100, y: 100 + SIT_RANGE + 5 })).toBeUndefined();
    expect(nearestFreeSeat(seats, new Set(["a", "b"]), { x: 100, y: 100 })).toBeUndefined();
  });
});

describe("pickStandSpot", () => {
  // Open floor except the tile at column 3, row 3 (the "chair" and the tile behind it).
  const grid = createGrid(10, 10, 32, (col, row) => col === 3 && row <= 4);
  const chair = seat("c", 3 * 32 + 16, 3 * 32 + 16, "up");

  it("puts you back where you sat down when that is open", () => {
    expect(pickStandSpot(grid, chair, { x: 200, y: 200 })).toEqual({ x: 200, y: 200 });
  });

  it("steps out from the seat when the old spot is blocked", () => {
    const blocked = { x: 3 * 32 + 16, y: 4 * 32 + 16 };
    // Facing up, so out is below; the tile below the chair is a wall here, so it goes on to the next.
    const spot = pickStandSpot(grid, chair, blocked);
    expect(spot).not.toEqual(blocked);
    expect(spot).not.toEqual({ x: chair.x, y: chair.y + 32 });
  });
});

describe("furnitureSeats", () => {
  it("makes a seat for a placed chair and none for a rug", () => {
    const seats = furnitureSeats([
      { id: "p1", itemId: "chair", col: 2, row: 3 },
      { id: "p2", itemId: "rug", col: 5, row: 5 },
    ]);
    expect(seats).toEqual([{ id: "fp1", x: 2 * 32 + 16, y: 3 * 32 + 20, facing: "down" }]);
  });
});

describe("parseSeats", () => {
  const layer = (objects: unknown[]) => ({ layers: [{ name: "seats", objects }] });
  const props = (facing: unknown, art?: string) => [
    { name: "facing", value: facing },
    ...(art ? [{ name: "art", value: art }] : []),
  ];

  it("reads seats with their facing and art", () => {
    expect(
      parseSeats(layer([{ id: 61, x: 10, y: 20, properties: props("up", "desk-chair") }])),
    ).toEqual([{ id: "s61", x: 10, y: 20, facing: "up", art: "desk-chair" }]);
  });

  it("skips a seat with no valid facing and tolerates a missing layer", () => {
    expect(parseSeats(layer([{ id: 1, x: 1, y: 2, properties: props("sideways") }]))).toEqual([]);
    expect(parseSeats(layer([{ id: 1, x: 1, y: 2 }]))).toEqual([]);
    expect(parseSeats({ layers: [] })).toEqual([]);
    expect(parseSeats(null)).toEqual([]);
  });
});
