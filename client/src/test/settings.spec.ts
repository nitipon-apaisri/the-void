import { describe, expect, it } from "vitest";

import { readDirection, type MoveKeys } from "../systems/controls";
import {
  PROXIMITY_MAX_TILES,
  PROXIMITY_MIN_TILES,
  defaultSettings,
  sanitizeSettings,
} from "../systems/settings";

const defaults = defaultSettings(3);

describe("sanitizeSettings", () => {
  it("returns the defaults for nothing or junk", () => {
    expect(sanitizeSettings(undefined, defaults)).toEqual(defaults);
    expect(sanitizeSettings("nope", defaults)).toEqual(defaults);
    expect(sanitizeSettings(null, defaults)).toEqual(defaults);
  });

  it("keeps valid values", () => {
    const saved = {
      ...defaults,
      proximityTiles: 1.5,
      volume: 0.4,
      keys: "wasd",
      micDeviceId: "mic",
    };
    expect(sanitizeSettings(saved, defaults)).toEqual(saved);
  });

  it("clamps numbers into range", () => {
    const result = sanitizeSettings({ proximityTiles: 999, volume: -2 }, defaults);
    expect(result.proximityTiles).toBe(PROXIMITY_MAX_TILES);
    expect(result.volume).toBe(0);
    expect(sanitizeSettings({ proximityTiles: 0 }, defaults).proximityTiles).toBe(
      PROXIMITY_MIN_TILES,
    );
  });

  it("falls back per field when a value has the wrong type", () => {
    const result = sanitizeSettings(
      { proximityTiles: "5", volume: Number.NaN, keys: "dvorak", micDeviceId: 7 },
      defaults,
    );
    expect(result).toEqual(defaults);
  });
});

const idle = { up: false, down: false, left: false, right: false };
const keys = (
  arrows: Partial<MoveKeys["arrows"]>,
  wasd: Partial<MoveKeys["wasd"]> = {},
): MoveKeys => ({
  arrows: { ...idle, ...arrows },
  wasd: { ...idle, ...wasd },
});

describe("readDirection", () => {
  it("reads arrows and ignores WASD in arrows mode", () => {
    expect(readDirection(keys({ right: true }, { up: true }), "arrows")).toEqual({ dx: 1, dy: 0 });
  });

  it("reads WASD and ignores arrows in wasd mode", () => {
    expect(readDirection(keys({ right: true }, { up: true }), "wasd")).toEqual({ dx: 0, dy: -1 });
  });

  it("accepts both in both mode", () => {
    expect(readDirection(keys({ right: true }, { up: true }), "both")).toEqual({ dx: 1, dy: -1 });
  });

  it("cancels opposite keys", () => {
    expect(readDirection(keys({ left: true, right: true }), "arrows")).toEqual({ dx: 0, dy: 0 });
  });
});
