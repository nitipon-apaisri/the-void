import { describe, expect, it } from "vitest";

import { DEFAULT_LOOK, LOOK_COUNTS, decodeLook, encodeLook, isLook } from "../index";

describe("look", () => {
  it("round-trips through its text form", () => {
    const look = { body: 3, eyes: 6, outfit: 131, hair: 199, accessory: -1 };
    expect(encodeLook(look)).toBe("3.6.131.199.-1");
    expect(decodeLook(encodeLook(look))).toEqual(look);
  });

  it("accepts the default and the last of each part", () => {
    expect(isLook(DEFAULT_LOOK)).toBe(true);
    expect(
      isLook({
        body: LOOK_COUNTS.body - 1,
        eyes: LOOK_COUNTS.eyes - 1,
        outfit: LOOK_COUNTS.outfit - 1,
        hair: LOOK_COUNTS.hair - 1,
        accessory: LOOK_COUNTS.accessory - 1,
      }),
    ).toBe(true);
  });

  it.each([
    "",
    "1.2.3",
    "1.2.3.4.5.6",
    "a.b.c.d.e",
    "9.0.0.0.-1",
    "0.0.0.0.84",
    "0.0.0.0.-2",
    "1.2.3.4.5 ",
  ])("decodes %j to nothing", (text) => {
    expect(decodeLook(text)).toBeUndefined();
  });

  it("only lets the accessory be -1", () => {
    expect(isLook({ ...DEFAULT_LOOK, hair: -1 })).toBe(false);
  });
});
