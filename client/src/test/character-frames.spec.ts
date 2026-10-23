import { describe, expect, it } from "vitest";

import { FRAME, facingFor, frameRange } from "../systems/character-frames";

describe("frameRange", () => {
  it("starts idle on the second row, facing right", () => {
    expect(frameRange("idle", "right")).toEqual({ start: FRAME.columns, end: FRAME.columns + 5 });
  });

  it("puts walk on the third row and steps 6 frames per direction", () => {
    expect(frameRange("walk", "up").start).toBe(FRAME.columns * 2 + 6);
    expect(frameRange("walk", "left").start).toBe(FRAME.columns * 2 + 12);
    expect(frameRange("walk", "down")).toEqual({
      start: FRAME.columns * 2 + 18,
      end: FRAME.columns * 2 + 23,
    });
  });
});

describe("facingFor", () => {
  it("follows the longer axis", () => {
    expect(facingFor(5, 1, "down")).toBe("right");
    expect(facingFor(-5, 1, "down")).toBe("left");
    expect(facingFor(1, -5, "right")).toBe("up");
    expect(facingFor(1, 5, "right")).toBe("down");
  });

  it("keeps the current facing when standing still", () => {
    expect(facingFor(0, 0, "left")).toBe("left");
  });

  it("keeps a vertical facing on a perfect diagonal, otherwise goes horizontal", () => {
    expect(facingFor(1, 1, "down")).toBe("down");
    expect(facingFor(1, 1, "left")).toBe("right");
  });
});
