import { describe, expect, it } from "vitest";

import { stepPosition } from "../systems/movement";

describe("stepPosition", () => {
  it("does not move without input", () => {
    const pos = { x: 5, y: 5 };
    expect(stepPosition(pos, { dx: 0, dy: 0 }, 100, 16)).toEqual(pos);
  });

  it("moves speed * seconds along one axis", () => {
    expect(stepPosition({ x: 0, y: 0 }, { dx: 1, dy: 0 }, 200, 500)).toEqual({ x: 100, y: 0 });
  });

  it("normalises diagonals", () => {
    const next = stepPosition({ x: 0, y: 0 }, { dx: 1, dy: 1 }, 100, 1000);
    expect(Math.hypot(next.x, next.y)).toBeCloseTo(100);
  });
});
