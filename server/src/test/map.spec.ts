import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collidesCircle,
  findSpawn,
  mapName,
  PLAYER_RADIUS,
  SPACE_SIZE_DIMENSIONS,
  SPACE_SIZES,
  SPACE_TEMPLATES,
} from "@void/shared";

import { parseCollisionGrid } from "../services/map.service.js";

const { cols: MAP_COLS, rows: MAP_ROWS } = SPACE_SIZE_DIMENSIONS.medium;
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
    const grid = parseCollisionGrid(map(data), "medium");
    expect(grid.blocked[2 * MAP_COLS + 3]).toBe(true);
    expect(grid.blocked[0]).toBe(false);
  });

  it("rejects a map of the wrong size or without a collision layer", () => {
    const data = Array.from({ length: MAP_COLS * MAP_ROWS }, () => 0);
    expect(() => parseCollisionGrid(map(data, { width: 10 }), "medium")).toThrow();
    expect(() => parseCollisionGrid(map(data, { layers: [] }), "medium")).toThrow();
    expect(() => parseCollisionGrid(map([1, 2, 3]), "medium")).toThrow();
    expect(() => parseCollisionGrid(null, "medium")).toThrow();
  });

  it("rejects a map of another size", () => {
    const data = Array.from({ length: MAP_COLS * MAP_ROWS }, () => 0);
    expect(() => parseCollisionGrid(map(data), "small")).toThrow();
  });

  const maps = SPACE_TEMPLATES.flatMap((template) =>
    SPACE_SIZES.map((size) => [template, size] as const),
  );
  it.each(maps)("builds the %s map at %s size with a walkable spawn point", (template, size) => {
    const file = new URL(
      `../../../client/src/assets/maps/${mapName(template, size)}.tmj`,
      import.meta.url,
    );
    const grid = parseCollisionGrid(JSON.parse(readFileSync(file, "utf8")), size);
    const spawn = findSpawn(grid, PLAYER_RADIUS);
    expect(collidesCircle(grid, spawn.x, spawn.y, PLAYER_RADIUS)).toBe(false);
  });
});
