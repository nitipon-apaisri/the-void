import { describe, expect, it } from "vitest";
import { WAVE_COOLDOWN_MS, WAVE_RANGE } from "@void/shared";

import { canWave, parseWave } from "../handlers/wave.handler.js";

describe("parseWave", () => {
  it("accepts a target id and drops anything else", () => {
    expect(parseWave({ targetId: "abc", admin: true })).toEqual({ targetId: "abc" });
  });

  it.each([
    null,
    undefined,
    5,
    "a",
    [],
    {},
    { targetId: 7 },
    { targetId: "" },
    { targetId: "x".repeat(99) },
  ])("rejects %j", (payload) => {
    expect(parseWave(payload)).toBeNull();
  });
});

describe("canWave", () => {
  const here = { x: 0, y: 0 };

  it("allows a wave at someone in range", () => {
    expect(canWave(here, { x: WAVE_RANGE, y: 0 }, false, 10_000, undefined)).toBe(true);
  });

  it("refuses someone out of range, and yourself", () => {
    expect(canWave(here, { x: WAVE_RANGE + 1, y: 0 }, false, 10_000, undefined)).toBe(false);
    expect(canWave(here, here, true, 10_000, undefined)).toBe(false);
  });

  it("refuses a second wave inside the cooldown", () => {
    const near = { x: 10, y: 0 };
    expect(canWave(here, near, false, 10_000 + WAVE_COOLDOWN_MS - 1, 10_000)).toBe(false);
    expect(canWave(here, near, false, 10_000 + WAVE_COOLDOWN_MS, 10_000)).toBe(true);
  });
});

describe("canWave with do not disturb", () => {
  it("refuses a wave at someone who is busy", () => {
    const here = { x: 0, y: 0 };
    expect(canWave(here, here, false, 1000, undefined, true)).toBe(false);
    expect(canWave(here, here, false, 1000, undefined, false)).toBe(true);
  });
});
