import { describe, expect, it } from "vitest";

import { canManageZones, zoneAt, zoneError, type MapZone } from "../index";

const zones: MapZone[] = [
  { id: "z1", name: "Meeting room 1", x: 100, y: 100, width: 200, height: 100 },
  { id: "z2", name: "Meeting room 2", x: 400, y: 100, width: 200, height: 100 },
];

describe("zoneAt", () => {
  it("finds the room a point is in", () => {
    expect(zoneAt(zones, { x: 150, y: 150 })).toBe("z1");
    expect(zoneAt(zones, { x: 500, y: 199 })).toBe("z2");
  });

  it("includes the top left edge and excludes the bottom right one", () => {
    expect(zoneAt(zones, { x: 100, y: 100 })).toBe("z1");
    expect(zoneAt(zones, { x: 300, y: 150 })).toBe("");
    expect(zoneAt(zones, { x: 150, y: 200 })).toBe("");
  });

  it("is empty outside every room and when the map has none", () => {
    expect(zoneAt(zones, { x: 350, y: 150 })).toBe("");
    expect(zoneAt([], { x: 150, y: 150 })).toBe("");
  });
});

describe("zoneError", () => {
  // 100 x 100 tiles; "z1" covers tiles (10, 10) to (19, 14).
  const existing: MapZone[] = [{ id: "z1", name: "A", x: 320, y: 320, width: 320, height: 160 }];
  const rect = (col: number, row: number, cols: number, rows: number) => ({ col, row, cols, rows });

  it("allows a room in free space", () => {
    expect(zoneError(rect(30, 30, 6, 5), existing, 100, 100)).toBeUndefined();
  });

  it("allows a room that only touches another", () => {
    expect(zoneError(rect(20, 10, 4, 4), existing, 100, 100)).toBeUndefined();
  });

  it("refuses a room that overlaps another", () => {
    expect(zoneError(rect(15, 12, 6, 6), existing, 100, 100)).toBe("that overlaps another room");
  });

  it("refuses rooms that are too small, too big or off the map", () => {
    expect(zoneError(rect(30, 30, 2, 5), existing, 100, 100)).toMatch(/at least/);
    expect(zoneError(rect(0, 0, 41, 5), existing, 100, 100)).toMatch(/at most/);
    expect(zoneError(rect(-1, 30, 5, 5), existing, 100, 100)).toMatch(/inside the map/);
    expect(zoneError(rect(97, 30, 5, 5), existing, 100, 100)).toMatch(/inside the map/);
  });

  it("refuses fractions", () => {
    expect(zoneError(rect(30.5, 30, 5, 5), existing, 100, 100)).toBe("invalid room");
  });
});

describe("canManageZones", () => {
  it("is for owners and admins", () => {
    expect(canManageZones("owner")).toBe(true);
    expect(canManageZones("admin")).toBe(true);
    expect(canManageZones("member")).toBe(false);
  });
});
