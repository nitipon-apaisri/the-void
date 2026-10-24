import { describe, expect, it } from "vitest";

import { audibleSpeakers } from "../systems/speaking";

describe("audibleSpeakers", () => {
  it("keeps only the speakers within hearing range", () => {
    const heard = audibleSpeakers(new Set(["a", "b", "far"]), new Set(["a", "b", "c"]));
    expect([...heard].sort()).toEqual(["a", "b"]);
  });

  it("is empty when nobody is talking or nobody is near", () => {
    expect(audibleSpeakers(new Set(), new Set(["a"])).size).toBe(0);
    expect(audibleSpeakers(new Set(["a"]), new Set()).size).toBe(0);
  });
});
