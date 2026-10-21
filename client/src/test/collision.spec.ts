import { describe, expect, it } from "vitest";

import { collidesCircle, createGrid, moveWithCollision } from "../systems/collision";

// 5x5 grid of 10px tiles with one solid tile at column 2, row 2 (x 20..30, y 20..30).
const grid = createGrid(5, 5, 10, (col, row) => col === 2 && row === 2);

describe("collidesCircle", () => {
  it("is false in open space", () => {
    expect(collidesCircle(grid, 5, 5, 3)).toBe(false);
  });

  it("is true when overlapping a blocked tile", () => {
    expect(collidesCircle(grid, 25, 25, 3)).toBe(true);
    expect(collidesCircle(grid, 18, 25, 3)).toBe(true);
  });

  it("is false when just touching the tile edge", () => {
    expect(collidesCircle(grid, 17, 25, 3)).toBe(false);
  });

  it("treats outside the map as solid", () => {
    expect(collidesCircle(grid, 1, 25, 3)).toBe(true);
    expect(collidesCircle(grid, 25, 49, 3)).toBe(true);
  });
});

describe("moveWithCollision", () => {
  it("moves freely when nothing is in the way", () => {
    expect(moveWithCollision(grid, { x: 5, y: 5 }, { x: 8, y: 6 }, 3)).toEqual({ x: 8, y: 6 });
  });

  it("stops at a wall", () => {
    expect(moveWithCollision(grid, { x: 15, y: 25 }, { x: 19, y: 25 }, 3)).toEqual({
      x: 15,
      y: 25,
    });
  });

  it("slides along a wall", () => {
    const next = moveWithCollision(grid, { x: 15, y: 25 }, { x: 19, y: 28 }, 3);
    expect(next).toEqual({ x: 15, y: 28 });
  });
});
