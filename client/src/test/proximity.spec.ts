import { describe, expect, it } from "vitest";

import { nearbyIds } from "../systems/proximity";

const me = { x: 0, y: 0 };

describe("nearbyIds", () => {
  it("includes players inside the radius and excludes those outside", () => {
    const result = nearbyIds(
      me,
      [
        { id: "near", x: 50, y: 0 },
        { id: "far", x: 500, y: 0 },
      ],
      100,
    );
    expect([...result]).toEqual(["near"]);
  });

  it("includes a player exactly on the radius", () => {
    expect(nearbyIds(me, [{ id: "edge", x: 100, y: 0 }], 100).has("edge")).toBe(true);
  });

  it("keeps a previously nearby player a little past the radius", () => {
    const others = [{ id: "a", x: 110, y: 0 }];
    expect(nearbyIds(me, others, 100).has("a")).toBe(false);
    expect(nearbyIds(me, others, 100, new Set(["a"])).has("a")).toBe(true);
  });

  it("drops a previously nearby player beyond the leave margin", () => {
    expect(nearbyIds(me, [{ id: "a", x: 130, y: 0 }], 100, new Set(["a"])).has("a")).toBe(false);
  });
});
