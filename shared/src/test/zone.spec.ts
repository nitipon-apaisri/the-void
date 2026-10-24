import { describe, expect, it } from "vitest";

import { zoneAt, type MapZone } from "../index";

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
