import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { MAP_COLS, MAP_ROWS, SPAWN, TILE_SIZE } from "../index";

const map = JSON.parse(
  readFileSync(new URL("../../../client/src/assets/maps/office.tmj", import.meta.url), "utf8"),
);
const objects = map.layers.find((l: { name: string }) => l.name === "objects");

describe("office.tmj matches the shared world constants", () => {
  it("has the same dimensions", () => {
    expect(map.width).toBe(MAP_COLS);
    expect(map.height).toBe(MAP_ROWS);
    expect(map.tilewidth).toBe(TILE_SIZE);
    expect(map.tileheight).toBe(TILE_SIZE);
  });

  it("has floor and objects layers", () => {
    expect(map.layers.map((l: { name: string }) => l.name)).toEqual(["floor", "objects"]);
  });

  it("spawns on a free tile", () => {
    const col = Math.floor(SPAWN.x / TILE_SIZE);
    const row = Math.floor(SPAWN.y / TILE_SIZE);
    expect(objects.data[row * MAP_COLS + col]).toBe(0);
  });
});
