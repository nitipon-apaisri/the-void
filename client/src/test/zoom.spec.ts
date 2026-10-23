import { describe, expect, it } from "vitest";

import { createWheelStepper, stepZoom } from "../systems/zoom";

describe("stepZoom", () => {
  it("moves one level at a time", () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(2, -1)).toBe(1.5);
    expect(stepZoom(2, 1)).toBe(3);
  });

  it("stops at the ends", () => {
    expect(stepZoom(3, 1)).toBe(3);
    expect(stepZoom(1, -1)).toBe(1);
  });

  it("snaps an odd value to the nearest level before stepping", () => {
    expect(stepZoom(1.9, 1)).toBe(3);
  });
});

describe("createWheelStepper", () => {
  it("waits until enough delta has built up", () => {
    const step = createWheelStepper(40);
    expect(step(-10)).toBe(0);
    expect(step(-10)).toBe(0);
    expect(step(-25)).toBe(1);
  });

  it("zooms out on positive deltas and starts over after a step", () => {
    const step = createWheelStepper(40);
    expect(step(100)).toBe(-1);
    expect(step(-10)).toBe(0);
  });
});
