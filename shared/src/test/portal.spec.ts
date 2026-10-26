import { describe, expect, it } from "vitest";

import { atPortal, PORTAL_REACH, PORTAL_TILES, portalError } from "../portal";

const TILE = 32;

describe("atPortal", () => {
  const portal = { col: 10, row: 5 };

  it("accepts a point inside the portal", () => {
    expect(atPortal(portal, { x: 10 * TILE + 8, y: 5 * TILE + 8 })).toBe(true);
  });

  it("accepts a point within the reach of the edge", () => {
    expect(atPortal(portal, { x: 10 * TILE - PORTAL_REACH, y: 5 * TILE })).toBe(true);
  });

  it("rejects a point past the reach", () => {
    expect(atPortal(portal, { x: 10 * TILE - PORTAL_REACH - 1, y: 5 * TILE })).toBe(false);
    expect(atPortal(portal, { x: (10 + PORTAL_TILES) * TILE + PORTAL_REACH, y: 5 * TILE })).toBe(
      false,
    );
  });
});

describe("portalError", () => {
  it("accepts a free spot", () => {
    expect(portalError({ col: 3, row: 3 }, [], 60, 45)).toBeUndefined();
  });

  it("refuses a spot that sticks out of the map", () => {
    expect(portalError({ col: 59, row: 3 }, [], 60, 45)).toBe("that is outside the map");
    expect(portalError({ col: -1, row: 3 }, [], 60, 45)).toBe("that is outside the map");
  });

  it("refuses a spot on another portal, but allows one that only touches", () => {
    const others = [{ col: 3, row: 3 }];
    expect(portalError({ col: 4, row: 4 }, others, 60, 45)).toBe("another portal is there");
    expect(portalError({ col: 5, row: 3 }, others, 60, 45)).toBeUndefined();
  });

  it("refuses a fractional tile", () => {
    expect(portalError({ col: 1.5, row: 3 }, [], 60, 45)).toBe("invalid request");
  });
});
