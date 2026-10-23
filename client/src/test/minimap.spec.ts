import { describe, expect, it } from "vitest";

import { fromMinimap, minimapScale, toMinimap } from "../systems/minimap";

const world = { width: 2880, height: 2144 };

describe("minimapScale", () => {
  it("keeps the world's proportions", () => {
    const scale = minimapScale(world, 180);
    expect(scale.factor).toBe(180 / 2880);
    expect(scale.height).toBe(134);
  });
});

describe("toMinimap and fromMinimap", () => {
  const scale = minimapScale(world, 180);

  it("map a point to the mini map and back", () => {
    const pos = { x: 1440, y: 1072 };
    const there = toMinimap(pos, scale);
    expect(there).toEqual({ x: 90, y: 67 });
    expect(fromMinimap(there, scale, world)).toEqual(pos);
  });

  it("keeps a click inside the world", () => {
    expect(fromMinimap({ x: -10, y: 9999 }, scale, world)).toEqual({ x: 0, y: world.height });
  });
});
