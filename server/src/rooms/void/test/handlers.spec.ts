import { describe, expect, it } from "vitest";
import { MAX_COORDINATE, MAX_NAME_LENGTH } from "@void/shared";

import { sanitizeName } from "../handlers/join.handler.js";
import { parseMove } from "../handlers/move.handler.js";

describe("parseMove", () => {
  it("accepts finite in-range coordinates", () => {
    expect(parseMove({ x: 10, y: -20 })).toEqual({ x: 10, y: -20 });
  });

  it("drops extra fields", () => {
    expect(parseMove({ x: 1, y: 2, admin: true })).toEqual({ x: 1, y: 2 });
  });

  it.each([null, undefined, 5, "x", [], {}, { x: 1 }, { x: "1", y: 2 }, { x: NaN, y: 0 }])(
    "rejects %j",
    (payload) => {
      expect(parseMove(payload)).toBeNull();
    },
  );

  it("rejects infinity and out-of-range values", () => {
    expect(parseMove({ x: Infinity, y: 0 })).toBeNull();
    expect(parseMove({ x: MAX_COORDINATE + 1, y: 0 })).toBeNull();
  });
});

describe("sanitizeName", () => {
  it("trims and caps length", () => {
    expect(sanitizeName("  alice  ")).toBe("alice");
    expect(sanitizeName("a".repeat(100))).toHaveLength(MAX_NAME_LENGTH);
  });

  it("falls back to guest", () => {
    expect(sanitizeName(undefined)).toBe("guest");
    expect(sanitizeName("   ")).toBe("guest");
    expect(sanitizeName(42)).toBe("guest");
  });
});
