import { describe, expect, it } from "vitest";
import { LOOK_COUNTS, NO_ACCESSORY, isLook } from "@void/shared";

import {
  groupStyles,
  locate,
  randomLook,
  stepColour,
  stepStyle,
  wrap,
} from "../systems/look-groups";

// Style 1 has two colours listed out of order, style 2 has one, style 3 has three.
const entries = [
  { style: 1, name: "", variant: 2 },
  { style: 1, name: "", variant: 1 },
  { style: 2, name: "Bee", variant: 1 },
  { style: 3, name: "", variant: 1 },
  { style: 3, name: "", variant: 2 },
  { style: 3, name: "", variant: 3 },
];
const groups = groupStyles(entries);

describe("groupStyles", () => {
  it("groups by style and orders colours by variant", () => {
    expect(groups.map((g) => g.indices)).toEqual([[1, 0], [2], [3, 4, 5]]);
    expect(groups[1]!.name).toBe("Bee");
  });
});

describe("wrap and locate", () => {
  it("wraps both ways", () => {
    expect(wrap(0, -1, 5)).toBe(4);
    expect(wrap(4, 1, 5)).toBe(0);
  });

  it("finds the style and colour of an index", () => {
    expect(locate(groups, 0)).toEqual({ group: 0, colour: 1 });
    expect(locate(groups, NO_ACCESSORY)).toBeUndefined();
  });
});

describe("stepStyle", () => {
  it("keeps the colour number where the next style has it", () => {
    // Index 0 is style 1, colour 2; style 2 has one colour, so the step clamps to it.
    expect(stepStyle(groups, 0, 1, false)).toBe(2);
    // Index 4 is style 3, colour 2; wrapping to style 1 keeps colour 2, which is index 0.
    expect(stepStyle(groups, 4, 1, false)).toBe(0);
  });

  it("passes through no accessory when optional", () => {
    expect(stepStyle(groups, 1, -1, true)).toBe(NO_ACCESSORY);
    expect(stepStyle(groups, NO_ACCESSORY, 1, true)).toBe(1);
    expect(stepStyle(groups, NO_ACCESSORY, -1, true)).toBe(3);
  });
});

describe("stepColour", () => {
  it("cycles inside the style", () => {
    expect(stepColour(groups, 3, 1)).toBe(4);
    expect(stepColour(groups, 5, 1)).toBe(3);
    expect(stepColour(groups, 2, 1)).toBe(2);
  });

  it("leaves no accessory alone", () => {
    expect(stepColour(groups, NO_ACCESSORY, 1)).toBe(NO_ACCESSORY);
  });
});

describe("randomLook", () => {
  it("always makes a valid look, including at the ends of the range", () => {
    expect(isLook(randomLook(() => 0))).toBe(true);
    expect(isLook(randomLook(() => 0.999999))).toBe(true);
    expect(randomLook(() => 0.5).accessory).toBe(NO_ACCESSORY);
    expect(randomLook(() => 0).accessory).toBe(0);
    expect(randomLook(() => 0.999999).hair).toBe(LOOK_COUNTS.hair - 1);
  });
});
