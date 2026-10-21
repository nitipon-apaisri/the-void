import { describe, expect, it } from "vitest";
import { SPAWN, WORLD_HEIGHT, WORLD_WIDTH } from "@void/shared";

import { resolveSpawn } from "../handlers/join.handler.js";
import { parseMove } from "../handlers/move.handler.js";

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
    expect(resolveSpawn(100, 200)).toEqual({ x: 100, y: 200 });
  });

  it("falls back to the default spawn without a saved position", () => {
    expect(resolveSpawn(null, null)).toEqual({ x: SPAWN.x, y: SPAWN.y });
    expect(resolveSpawn(100, null)).toEqual({ x: SPAWN.x, y: SPAWN.y });
  });

  it("falls back when the saved position is outside the world or not finite", () => {
    expect(resolveSpawn(WORLD_WIDTH + 1, 0)).toEqual({ x: SPAWN.x, y: SPAWN.y });
    expect(resolveSpawn(0, -5)).toEqual({ x: SPAWN.x, y: SPAWN.y });
    expect(resolveSpawn(NaN, 0)).toEqual({ x: SPAWN.x, y: SPAWN.y });
  });
});
