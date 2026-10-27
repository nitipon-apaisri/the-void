import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SPACE_SIZE_DIMENSIONS, TILE_SIZE } from "../index";

const map = JSON.parse(
  readFileSync(new URL("../../../client/src/assets/maps/office.tmj", import.meta.url), "utf8"),
);

const { cols: MAP_COLS, rows: MAP_ROWS } = SPACE_SIZE_DIMENSIONS.medium;

describe("office.tmj matches the shared medium size", () => {
  it("has the same dimensions", () => {
    expect(map.width).toBe(MAP_COLS);
    expect(map.height).toBe(MAP_ROWS);
    expect(map.tilewidth).toBe(TILE_SIZE);
    expect(map.tileheight).toBe(TILE_SIZE);
  });

  it("has the floor, decor, objects and collision layers", () => {
    const names = map.layers.map((l: { name: string }) => l.name);
    expect(names).toEqual(expect.arrayContaining(["floor", "decor", "objects", "collision"]));
  });
});
