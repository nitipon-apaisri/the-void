import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collidesCircle,
  MAP_COLS,
  MAP_ROWS,
  PLAYER_RADIUS,
  SPACE_TEMPLATES,
  SPAWN,
} from "@void/shared";

import { parseCollisionGrid } from "../services/map.service.js";

const map = (data: number[], extra: object = {}) => ({
  width: MAP_COLS,
  height: MAP_ROWS,
  tilewidth: 32,
  layers: [{ name: "collision", data }],
  ...extra,
});

describe("parseCollisionGrid", () => {
  it("marks every non-empty tile as blocked", () => {
    const data = Array.from({ length: MAP_COLS * MAP_ROWS }, () => 0);
    data[2 * MAP_COLS + 3] = 7;
    const grid = parseCollisionGrid(map(data));
    expect(grid.blocked[2 * MAP_COLS + 3]).toBe(true);
    expect(grid.blocked[0]).toBe(false);
  });

  it("rejects a map of the wrong size or without a collision layer", () => {
    const data = Array.from({ length: MAP_COLS * MAP_ROWS }, () => 0);
    expect(() => parseCollisionGrid(map(data, { width: 10 }))).toThrow();
    expect(() => parseCollisionGrid(map(data, { layers: [] }))).toThrow();
    expect(() => parseCollisionGrid(map([1, 2, 3]))).toThrow();
    expect(() => parseCollisionGrid(null)).toThrow();
  });

  it.each(SPACE_TEMPLATES)("keeps the %s map walkable at the spawn point", (template) => {
    const file = new URL(`../../../client/src/assets/maps/${template}.tmj`, import.meta.url);
    const grid = parseCollisionGrid(JSON.parse(readFileSync(file, "utf8")));
    expect(collidesCircle(grid, SPAWN.x, SPAWN.y, PLAYER_RADIUS)).toBe(false);
  });
});
