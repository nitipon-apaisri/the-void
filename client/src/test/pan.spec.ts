import { describe, expect, it } from "vitest";

import { anchorCenter, isDrag, panBy } from "../systems/pan";

describe("isDrag", () => {
  it("treats a small wobble as a click", () => {
    expect(isDrag({ x: 100, y: 100 }, { x: 103, y: 102 })).toBe(false);
  });

  it("treats a longer move as a drag", () => {
    expect(isDrag({ x: 100, y: 100 }, { x: 110, y: 100 })).toBe(true);
  });
});

describe("panBy", () => {
  it("moves the view against the drag", () => {
    expect(panBy({ x: 100, y: 100 }, { x: 20, y: -10 }, 1)).toEqual({ x: 80, y: 110 });
  });

  it("moves less per pixel when zoomed in", () => {
    expect(panBy({ x: 100, y: 100 }, { x: 20, y: 0 }, 2)).toEqual({ x: 90, y: 100 });
  });
});

describe("anchorCenter", () => {
  it("does not move when the pointer is at the middle", () => {
    expect(anchorCenter({ x: 500, y: 400 }, { x: 0, y: 0 }, 1, 2)).toEqual({ x: 500, y: 400 });
  });

  it("keeps the point under the pointer fixed", () => {
    const center = { x: 500, y: 400 };
    const offset = { x: 100, y: -50 };
    const next = anchorCenter(center, offset, 1, 2);
    // world x under the pointer = centre + offset / zoom, before and after
    expect(next.x + offset.x / 2).toBeCloseTo(center.x + offset.x / 1);
    expect(next.y + offset.y / 2).toBeCloseTo(center.y + offset.y / 1);
  });
});
