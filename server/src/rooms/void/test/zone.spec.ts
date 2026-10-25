import { describe, expect, it } from "vitest";

import {
  parseAddZone,
  parseAnswerKnock,
  parseLockZone,
  parseModerate,
  parsePresent,
  presenterIn,
  parseRemoveZone,
} from "../handlers/zone.handler.js";

describe("parseAddZone", () => {
  it("accepts whole tile numbers", () => {
    expect(parseAddZone({ col: 2, row: 3, cols: 5, rows: 4, extra: 1 })).toEqual({
      col: 2,
      row: 3,
      cols: 5,
      rows: 4,
    });
  });

  it.each([
    null,
    "room",
    {},
    { col: 1, row: 1, cols: 3 },
    { col: 1.5, row: 1, cols: 3, rows: 3 },
    { col: "1", row: 1, cols: 3, rows: 3 },
    { col: NaN, row: 1, cols: 3, rows: 3 },
  ])("refuses %j", (payload) => {
    expect(parseAddZone(payload)).toBeNull();
  });
});

describe("parseRemoveZone", () => {
  it("accepts an id that looks like a uuid", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(parseRemoveZone({ id })).toEqual({ id });
  });

  it("refuses anything else, including the template's ids", () => {
    expect(parseRemoveZone({ id: "z7" })).toBeNull();
    expect(parseRemoveZone({})).toBeNull();
    expect(parseRemoveZone(undefined)).toBeNull();
  });
});

describe("parseLockZone", () => {
  it("needs an id and a boolean", () => {
    expect(parseLockZone({ id: "z1", locked: true })).toEqual({ id: "z1", locked: true });
    expect(parseLockZone({ id: "z1", locked: "yes" })).toBeNull();
    expect(parseLockZone({ locked: true })).toBeNull();
    expect(parseLockZone(null)).toBeNull();
  });
});

describe("parseAnswerKnock", () => {
  it("needs the knocker and a boolean", () => {
    expect(parseAnswerKnock({ knockerId: "abc", allow: false })).toEqual({
      knockerId: "abc",
      allow: false,
    });
    expect(parseAnswerKnock({ knockerId: "abc" })).toBeNull();
    expect(parseAnswerKnock({ knockerId: 5, allow: true })).toBeNull();
    expect(parseAnswerKnock("x")).toBeNull();
  });
});

describe("parsePresent", () => {
  it("needs a boolean", () => {
    expect(parsePresent({ on: true })).toEqual({ on: true });
    expect(parsePresent({ on: 1 })).toBeNull();
    expect(parsePresent(undefined)).toBeNull();
  });
});

describe("presenterIn", () => {
  const me = { zone: "z1", presenting: false, name: "Me" };
  const players = [
    me,
    { zone: "z1", presenting: true, name: "Sam" },
    { zone: "z2", presenting: true, name: "Kim" },
    { zone: "", presenting: true, name: "Lee" },
  ];

  it("names someone else presenting in the same room", () => {
    expect(presenterIn(players, "z1", me)).toBe("Sam");
  });

  it("ignores yourself and other rooms", () => {
    const sam = players[1]!;
    expect(presenterIn(players, "z1", sam)).toBeUndefined();
    expect(presenterIn(players, "z3", me)).toBeUndefined();
  });

  it("has no limit on the open floor", () => {
    expect(presenterIn(players, "", me)).toBeUndefined();
  });
});

describe("parseModerate", () => {
  const userId = "11111111-1111-4111-8111-111111111111";

  it("accepts a user id with a known action", () => {
    expect(parseModerate({ userId, action: "mute" })).toEqual({ userId, action: "mute" });
    expect(parseModerate({ userId, action: "stop-presenting" })).toEqual({
      userId,
      action: "stop-presenting",
    });
  });

  it("refuses anything else", () => {
    expect(parseModerate(null)).toBeNull();
    expect(parseModerate({ userId: "nope", action: "mute" })).toBeNull();
    expect(parseModerate({ userId, action: "ban" })).toBeNull();
    expect(parseModerate({ userId })).toBeNull();
  });
});
