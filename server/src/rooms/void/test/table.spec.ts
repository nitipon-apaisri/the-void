import { describe, expect, it } from "vitest";
import { distanceToTable, tableInRange, type MapTable } from "@void/shared";

import { parseTables } from "../../../services/map.service.js";
import { checkClaim, parseClaim } from "../handlers/table.handler.js";

const desk = (id: string, x: number, y: number): MapTable => ({
  id,
  name: `Desk ${id}`,
  x,
  y,
  width: 128,
  height: 128,
});
const tables = [desk("1", 0, 0), desk("2", 400, 0)];

describe("parseClaim", () => {
  it("accepts a table id and drops anything else", () => {
    expect(parseClaim({ tableId: "7", admin: true })).toEqual({ tableId: "7" });
  });

  it.each([null, undefined, 5, "1", [], {}, { tableId: 7 }, { tableId: "x".repeat(40) }])(
    "rejects %j",
    (payload) => {
      expect(parseClaim(payload)).toBeNull();
    },
  );
});

describe("distanceToTable and tableInRange", () => {
  it("is zero inside a table and measures from the nearest edge outside", () => {
    expect(distanceToTable(tables[0]!, { x: 50, y: 50 })).toBe(0);
    expect(distanceToTable(tables[0]!, { x: 178, y: 50 })).toBe(50);
    expect(distanceToTable(tables[0]!, { x: 131, y: 132 })).toBe(5);
  });

  it("finds the closest table inside it, or none", () => {
    expect(tableInRange(tables, { x: 100, y: 60 })?.id).toBe("1");
    expect(tableInRange(tables, { x: 450, y: 60 })?.id).toBe("2");
    expect(tableInRange(tables, { x: 190, y: 60 })).toBeUndefined();
  });
});

describe("checkClaim", () => {
  const near = { x: 100, y: 100 };

  it("lets someone near a free desk claim it", () => {
    expect(checkClaim(tables, new Map(), "u1", "1", near)).toEqual({ ok: true, table: tables[0] });
  });

  it("refuses an unknown desk, a taken desk and a second desk", () => {
    const held = new Map([["2", { userId: "u1" }]]);
    expect(checkClaim(tables, new Map(), "u1", "9", near)).toMatchObject({ ok: false });
    expect(checkClaim(tables, new Map([["1", { userId: "u2" }]]), "u1", "1", near)).toMatchObject({
      ok: false,
      error: "that desk is taken",
    });
    expect(checkClaim(tables, held, "u1", "1", near)).toMatchObject({
      ok: false,
      error: "you already have a desk",
    });
  });

  it("refuses a claim from across the map", () => {
    expect(checkClaim(tables, new Map(), "u1", "1", { x: 900, y: 900 })).toMatchObject({
      ok: false,
      error: "walk up to the desk first",
    });
  });
});

describe("parseTables", () => {
  const layer = (objects: unknown[]) => ({ layers: [{ name: "tables", objects }] });

  it("reads the desks from the tables layer", () => {
    expect(
      parseTables(layer([{ id: 3, name: "Desk 3", x: 1, y: 2, width: 3, height: 4 }])),
    ).toEqual([{ id: "3", name: "Desk 3", x: 1, y: 2, width: 3, height: 4 }]);
  });

  it("skips malformed objects and tolerates a map without the layer", () => {
    expect(parseTables(layer([{ id: "a", x: 1, y: 2, width: 3, height: 4 }, { id: 1 }]))).toEqual(
      [],
    );
    expect(parseTables({ layers: [] })).toEqual([]);
    expect(parseTables(null)).toEqual([]);
  });
});
