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

import { parseCollisionGrid, parseZones } from "../services/map.service.js";

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

describe("parseZones", () => {
  const layer = (objects: object[]) => ({ layers: [{ name: "zones", objects }] });

  it("reads the meeting rooms, with ids that cannot clash with desks or chairs", () => {
    const zones = parseZones(
      layer([{ id: 7, name: "Meeting room 1", x: 64, y: 64, width: 320, height: 192 }]),
    );
    expect(zones).toEqual([
      { id: "z7", name: "Meeting room 1", x: 64, y: 64, width: 320, height: 192 },
    ]);
  });

  it("skips objects that are not rectangles and names unnamed rooms", () => {
    const zones = parseZones(
      layer([
        { id: 1, x: 0, y: 0, width: "wide", height: 10 },
        { id: 2, x: 0, y: 0, width: 10, height: 10 },
      ]),
    );
    expect(zones.map((z) => [z.id, z.name])).toEqual([["z2", "Room 2"]]);
  });

  it("is empty when the map has no zones layer", () => {
    expect(parseZones({ layers: [] })).toEqual([]);
    expect(parseZones(undefined)).toEqual([]);
  });

  it.each(SPACE_TEMPLATES.flatMap((t) => SPACE_SIZES.map((s) => [t, s] as const)))(
    "the %s map at %s size has its rooms inside the map",
    (template, size) => {
      const file = new URL(
        `../../../client/src/assets/maps/${mapName(template, size)}.tmj`,
        import.meta.url,
      );
      const { cols, rows } = SPACE_SIZE_DIMENSIONS[size];
      for (const z of parseZones(JSON.parse(readFileSync(file, "utf8")))) {
        expect(z.x + z.width).toBeLessThanOrEqual(cols * 32);
        expect(z.y + z.height).toBeLessThanOrEqual(rows * 32);
      }
    },
  );
});
