import { describe, expect, it } from "vitest";
import {
  blockRect,
  ART_CATALOG,
  canEmptySpace,
  customId,
  createGrid,
  findFurniture,
  placementError,
  setBlocked,
  type FurnitureItem,
} from "@void/shared";

import { parsePlace, parseRemove } from "../handlers/furniture.handler.js";

const grid = createGrid(20, 20, 32, (col, row) => col === 5 && row === 5);
const none = { people: [], personRadius: 12, tables: [] };
const item = (id: string): FurnitureItem => findFurniture(id)!;

describe("parsePlace", () => {
  it("accepts a catalogue item at whole tiles", () => {
    expect(parsePlace({ itemId: "plant", col: 3, row: 4, extra: 1 })).toMatchObject({
      itemId: "plant",
      col: 3,
      row: 4,
    });
  });

  it.each([
    null,
    5,
    {},
    { itemId: "nope", col: 1, row: 1 },
    { itemId: "plant", col: 1.5, row: 1 },
    { itemId: "plant", col: "1", row: 1 },
    { itemId: 7, col: 1, row: 1 },
  ])("rejects %j", (payload) => {
    expect(parsePlace(payload)).toBeNull();
  });
});

describe("parseRemove", () => {
  it("wants a uuid", () => {
    const id = "6f1c7a52-3c1b-4f55-9a53-0d7b8e3f1a11";
    expect(parseRemove({ id })).toEqual({ id });
    expect(parseRemove({ id: "1" })).toBeNull();
    expect(parseRemove(null)).toBeNull();
  });
});

describe("canEmptySpace", () => {
  it("is for owners and admins", () => {
    expect(canEmptySpace("owner")).toBe(true);
    expect(canEmptySpace("admin")).toBe(true);
    expect(canEmptySpace("member")).toBe(false);
  });
});

describe("free-form pieces", () => {
  it("reads a rectangle of a sheet, solid or walkable", () => {
    const rug = findFurniture(customId("generic", 9, 4, 4, 3, false));
    expect(rug).toMatchObject({ sheet: "generic", sx: 9, sy: 4, w: 4, h: 3 });
    expect(rug?.block).toBeUndefined();
    expect(findFurniture(customId("walls", 0, 0, 2, 2, true))?.block).toEqual({
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
  });

  it("accepts every piece in the art catalogue", () => {
    for (const { pieces } of ART_CATALOG) {
      for (const p of pieces) {
        expect(findFurniture(customId(p.sheet, p.sx, p.sy, p.w, p.h, true)), p.name).toBeDefined();
      }
    }
  });

  it("refuses anything outside the sheet or too big", () => {
    expect(findFurniture(customId("conference", 15, 11, 2, 1, false))).toBeUndefined();
    expect(findFurniture("x:generic:0:0:11:1:0")).toBeUndefined();
    expect(findFurniture("x:nope:0:0:1:1:0")).toBeUndefined();
    expect(findFurniture("x:generic:0:0:0:1:0")).toBeUndefined();
  });
});

describe("placementError", () => {
  it("accepts open floor and refuses outside the map", () => {
    expect(placementError(grid, item("plant"), 2, 2, none)).toBeUndefined();
    expect(placementError(grid, item("desk"), 18, 2, none)).toBeDefined();
    expect(placementError(grid, item("plant"), -1, 2, none)).toBeDefined();
  });

  it("refuses a blocking item on a wall or on another piece, but a rug may overlap", () => {
    expect(placementError(grid, item("plant"), 5, 5, none)).toBeDefined();
    const copy = { ...grid, blocked: [...grid.blocked] };
    setBlocked(copy, item("plant"), 2, 2, true);
    expect(placementError(copy, item("chair"), 2, 2, none)).toBeDefined();
    expect(placementError(copy, item("rug"), 1, 1, none)).toBeUndefined();
    setBlocked(copy, item("plant"), 2, 2, false);
    expect(placementError(copy, item("chair"), 2, 2, none)).toBeUndefined();
  });

  it("keeps desk boxes and people clear", () => {
    const tables = [{ x: 64, y: 64, width: 128, height: 128 }];
    expect(placementError(grid, item("plant"), 3, 3, { ...none, tables })).toBeDefined();
    expect(placementError(grid, item("plant"), 12, 12, { ...none, tables })).toBeUndefined();
    const people = [{ x: 2 * 32 + 16, y: 2 * 32 + 16 }];
    expect(placementError(grid, item("plant"), 2, 2, { ...none, people })).toBeDefined();
    expect(placementError(grid, item("rug"), 2, 2, { ...none, people })).toBeUndefined();
  });
});

describe("blockRect", () => {
  it("is offset from the top-left and absent for a rug", () => {
    expect(blockRect(item("bookshelf"), 4, 4)).toEqual({ col: 4, row: 6, w: 1, h: 1 });
    expect(blockRect(item("rug"), 4, 4)).toBeUndefined();
  });
});
