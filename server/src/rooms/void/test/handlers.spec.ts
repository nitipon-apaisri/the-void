import { describe, expect, it } from "vitest";
import { createGrid, PLAYER_SPEED, SPAWN, WORLD_HEIGHT, WORLD_WIDTH } from "@void/shared";

import { resolveSpawn } from "../handlers/join.handler.js";
import { acceptMove, MoveBudget, parseMove } from "../handlers/move.handler.js";

// Open floor with one wall tile at column 5, row 5.
const grid = createGrid(20, 20, 32, (col, row) => col === 5 && row === 5);

describe("parseMove", () => {
  it("accepts finite in-range coordinates", () => {
    expect(parseMove({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
  });

  it("drops extra fields", () => {
    expect(parseMove({ x: 1, y: 2, admin: true })).toEqual({ x: 1, y: 2 });
  });

  it.each([null, undefined, 5, "x", [], {}, { x: 1 }, { x: "1", y: 2 }, { x: NaN, y: 0 }])(
    "rejects %j",
    (payload) => {
      expect(parseMove(payload)).toBeNull();
    },
  );

  it("rejects infinity and positions outside the world", () => {
    expect(parseMove({ x: Infinity, y: 0 })).toBeNull();
    expect(parseMove({ x: -1, y: 0 })).toBeNull();
    expect(parseMove({ x: WORLD_WIDTH + 1, y: 0 })).toBeNull();
    expect(parseMove({ x: 0, y: WORLD_HEIGHT + 1 })).toBeNull();
  });
});

describe("resolveSpawn", () => {
  it("returns the saved position when it is inside the world", () => {
    expect(resolveSpawn(100, 200, grid)).toEqual({ x: 100, y: 200 });
  });

  it("falls back when the saved position is inside a wall", () => {
    expect(resolveSpawn(5 * 32 + 16, 5 * 32 + 16, grid)).toEqual({ x: SPAWN.x, y: SPAWN.y });
  });

  it("falls back to the default spawn without a saved position", () => {
    expect(resolveSpawn(null, null, grid)).toEqual({ x: SPAWN.x, y: SPAWN.y });
    expect(resolveSpawn(100, null, grid)).toEqual({ x: SPAWN.x, y: SPAWN.y });
  });

  it("falls back when the saved position is outside the world or not finite", () => {
    expect(resolveSpawn(WORLD_WIDTH + 1, 0, grid)).toEqual({ x: SPAWN.x, y: SPAWN.y });
    expect(resolveSpawn(0, -5, grid)).toEqual({ x: SPAWN.x, y: SPAWN.y });
    expect(resolveSpawn(NaN, 0, grid)).toEqual({ x: SPAWN.x, y: SPAWN.y });
  });
});

describe("acceptMove", () => {
  const at = (x: number, y: number) => ({ x, y });

  it("accepts a short step on open floor", () => {
    expect(acceptMove(grid, new MoveBudget(0), at(50, 50), at(60, 50), 100)).toBe(true);
  });

  it("refuses a position inside a wall", () => {
    expect(
      acceptMove(grid, new MoveBudget(0), at(130, 176), at(5 * 32 + 16, 5 * 32 + 16), 100),
    ).toBe(false);
  });

  it("refuses a jump further than anyone can walk", () => {
    expect(acceptMove(grid, new MoveBudget(0), at(50, 50), at(600, 50), 100)).toBe(false);
  });

  it("does not let many small steps add up to a sprint", () => {
    const budget = new MoveBudget(0);
    let x = 50;
    let refused = 0;
    // 100 steps of 20px in 100ms: 20000 px/s against a speed of PLAYER_SPEED.
    for (let i = 1; i <= 100; i++) {
      if (acceptMove(grid, budget, at(x, 50), at(x + 20, 50), i)) x += 20;
      else refused++;
    }
    expect(refused).toBeGreaterThan(0);
    expect(x - 50).toBeLessThan(PLAYER_SPEED * 1.25 * 1.2);
  });

  it("lets a delayed packet carrying a longer step through", () => {
    // 800 ms of silence at walking speed is about 144 px.
    expect(acceptMove(grid, new MoveBudget(0), at(50, 50), at(50, 190), 800)).toBe(true);
  });
});
