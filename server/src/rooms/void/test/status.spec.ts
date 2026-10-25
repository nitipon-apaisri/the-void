import { describe, expect, it } from "vitest";

import { parseSetStatus } from "../handlers/status.handler.js";

describe("parseSetStatus", () => {
  it("accepts the three statuses", () => {
    for (const status of ["available", "away", "busy"]) {
      expect(parseSetStatus({ status })).toEqual({ status });
    }
  });

  it("refuses anything else", () => {
    expect(parseSetStatus(null)).toBeNull();
    expect(parseSetStatus({})).toBeNull();
    expect(parseSetStatus({ status: "invisible" })).toBeNull();
    expect(parseSetStatus({ status: 1 })).toBeNull();
  });
});
