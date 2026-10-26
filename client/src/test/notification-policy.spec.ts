import { describe, expect, it } from "vitest";

import { shouldNotify } from "../systems/notification-policy";

describe("shouldNotify", () => {
  const base = { enabled: true, status: "available" as const, focused: false };

  it("notifies when the window is in the background", () => {
    expect(shouldNotify(base)).toBe(true);
    expect(shouldNotify({ ...base, status: "away" })).toBe(true);
  });

  it("stays quiet in front, on do not disturb, or when switched off", () => {
    expect(shouldNotify({ ...base, focused: true })).toBe(false);
    expect(shouldNotify({ ...base, status: "busy" })).toBe(false);
    expect(shouldNotify({ ...base, enabled: false })).toBe(false);
  });
});
