import { describe, expect, it } from "vitest";

import { formatInviteCode, INVITE_CODE_ALPHABET, normalizeInviteCode } from "../index";

describe("normalizeInviteCode", () => {
  it("accepts any case, spaces and dashes", () => {
    expect(normalizeInviteCode("k7m2p-9qxa4")).toBe("K7M2P9QXA4");
    expect(normalizeInviteCode(" K7M2P 9QXA4 ")).toBe("K7M2P9QXA4");
    expect(normalizeInviteCode("K7M2P9QXA4")).toBe("K7M2P9QXA4");
  });

  it.each([
    "",
    "K7M2P",
    "K7M2P9QXA45",
    // 0, O, 1, I and L look like other characters and are never issued.
    "K7M2P9QXA0",
    "K7M2P9QXAO",
    "K7M2P9QXA1",
    "K7M2P9QXAI",
    "K7M2P9QXAL",
    "K7M2P9QXA!",
    // A link token is not a code.
    "x".repeat(43),
  ])("rejects %j", (input) => {
    expect(normalizeInviteCode(input)).toBeUndefined();
  });
});

describe("formatInviteCode", () => {
  it("groups a code in two halves and round-trips", () => {
    expect(formatInviteCode("K7M2P9QXA4")).toBe("K7M2P-9QXA4");
    expect(normalizeInviteCode(formatInviteCode("K7M2P9QXA4"))).toBe("K7M2P9QXA4");
  });

  it("uses an alphabet without look-alike characters", () => {
    expect(INVITE_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
});
