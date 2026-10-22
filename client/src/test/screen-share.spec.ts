import { describe, expect, it } from "vitest";

import { sortByDistance } from "../systems/proximity";
import { pickScreenSharers } from "../systems/screen-share";

describe("pickScreenSharers", () => {
  it("takes the nearest sharers up to the cap", () => {
    const picked = pickScreenSharers(["a", "b", "c"], new Set(["b", "c"]), 1);
    expect([...picked]).toEqual(["b"]);
  });

  it("skips players who are not sharing", () => {
    expect(pickScreenSharers(["a", "b"], new Set(), 2).size).toBe(0);
  });

  it("ignores sharers who are out of range", () => {
    expect(pickScreenSharers(["a"], new Set(["z"]), 2).size).toBe(0);
  });

  it("returns everyone when under the cap", () => {
    expect(pickScreenSharers(["a", "b"], new Set(["a", "b"]), 5).size).toBe(2);
  });
});

describe("sortByDistance", () => {
  it("orders the wanted ids nearest first and drops the rest", () => {
    const others = [
      { id: "far", x: 90, y: 0 },
      { id: "near", x: 10, y: 0 },
      { id: "skip", x: 1, y: 0 },
    ];
    expect(sortByDistance({ x: 0, y: 0 }, others, new Set(["far", "near"]))).toEqual([
      "near",
      "far",
    ]);
  });
});
