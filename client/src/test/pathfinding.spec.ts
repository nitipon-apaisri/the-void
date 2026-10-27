import { describe, expect, it } from "vitest";

import { createGrid } from "../systems/collision";
import { findPath, followPath } from "../systems/pathfinding";

// 10 x 10 grid of 10px tiles with a wall down column 5, open only at row 8.
const grid = createGrid(10, 10, 10, (col, row) => col === 5 && row !== 8);
const RADIUS = 3;

describe("findPath", () => {
  it("walks straight when nothing is in the way", () => {
    expect(findPath(grid, { x: 5, y: 5 }, { x: 35, y: 25 }, RADIUS)).toEqual([{ x: 35, y: 25 }]);
  });

  it("goes round a wall through the gap", () => {
    const path = findPath(grid, { x: 25, y: 15 }, { x: 75, y: 15 }, RADIUS);
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual({ x: 75, y: 15 });
    // Somewhere on the way it passes the gap in row 8 (y 80..90).
    expect(path.some((p) => p.x >= 40 && p.x <= 60 && p.y >= 80 && p.y <= 90)).toBe(true);
  });

  it("ends at the nearest free tile when the click is inside a wall", () => {
    const path = findPath(grid, { x: 25, y: 15 }, { x: 55, y: 25 }, RADIUS);
    const last = path.at(-1)!;
    expect(Math.floor(last.x / 10)).not.toBe(5);
  });

  it("gives nothing when no free tile is near the click", () => {
    const sealed = createGrid(20, 20, 10, (col) => col >= 8 && col <= 14);
    expect(findPath(sealed, { x: 15, y: 15 }, { x: 115, y: 95 }, RADIUS)).toEqual([]);
  });

  it("gives nothing when the goal cannot be reached", () => {
    const closed = createGrid(10, 10, 10, (col) => col === 5);
    expect(findPath(closed, { x: 25, y: 15 }, { x: 75, y: 15 }, RADIUS)).toEqual([]);
  });
});

describe("followPath", () => {
  const path = [
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];

  it("heads for the first waypoint", () => {
    expect(followPath(path, { x: 0, y: 0 }, 2)).toEqual({ dx: 10, dy: 0, rest: path });
  });

  it("drops waypoints it reaches this frame", () => {
    const step = followPath(path, { x: 9, y: 0 }, 2);
    expect(step.rest).toEqual([{ x: 10, y: 10 }]);
    expect(step.dy).toBeGreaterThan(0);
  });

  it("stops at the end", () => {
    expect(followPath(path.slice(1), { x: 10, y: 9 }, 2)).toEqual({ dx: 0, dy: 0, rest: [] });
  });
});
