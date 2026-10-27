import { describe, expect, it } from "vitest";

import { ZOOM_MIN, effectiveZoom, stepZoom, zoomByWheel } from "../systems/zoom";

describe("stepZoom", () => {
  it("moves one level at a time", () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(2, -1)).toBe(1.5);
    expect(stepZoom(2, 1)).toBe(3);
  });

  it("stops at the ends", () => {
    expect(stepZoom(3, 1)).toBe(3);
    expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
  });

  it("snaps an odd value to the nearest level before stepping", () => {
    expect(stepZoom(1.9, 1)).toBe(3);
  });
});

describe("zoomByWheel", () => {
  it("zooms in on negative deltas and out on positive ones", () => {
    expect(zoomByWheel(1, -10)).toBeGreaterThan(1);
    expect(zoomByWheel(1, 10)).toBeLessThan(1);
  });

  it("stays inside the allowed range", () => {
    expect(zoomByWheel(3, -25)).toBe(3);
    expect(zoomByWheel(0.5, 25)).toBe(0.5);
  });

  it("limits one huge wheel click to a single modest step", () => {
    expect(zoomByWheel(1, 1000)).toBe(zoomByWheel(1, 25));
  });
});

describe("effectiveZoom", () => {
  const map = { width: 1280, height: 960 };

  it("grows to fill a window bigger than the map", () => {
    expect(effectiveZoom(1, { width: 1920, height: 1080 }, map)).toBe(1.5);
    expect(effectiveZoom(1, { width: 1280, height: 1440 }, map)).toBe(1.5);
  });

  it("keeps the chosen zoom when it is already larger", () => {
    expect(effectiveZoom(2, { width: 1920, height: 1080 }, map)).toBe(2);
  });

  it("keeps a small window at the chosen zoom", () => {
    expect(effectiveZoom(1, { width: 800, height: 600 }, map)).toBe(1);
  });
});
