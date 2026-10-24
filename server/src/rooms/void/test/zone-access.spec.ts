import { KNOCK_COOLDOWN_MS } from "@void/shared";
import { describe, expect, it } from "vitest";

import { ZoneAccess } from "../handlers/zone-access.js";

describe("ZoneAccess.mayEnter", () => {
  it("lets anyone into an open room", () => {
    expect(new ZoneAccess().mayEnter("z1", false, "a", "member")).toBe(true);
  });

  it("keeps members and admins out of a locked room until they are let in", () => {
    const access = new ZoneAccess();
    expect(access.mayEnter("z1", true, "a", "member")).toBe(false);
    expect(access.mayEnter("z1", true, "a", "admin")).toBe(false);
    access.admit("z1", "a");
    expect(access.mayEnter("z1", true, "a", "member")).toBe(true);
    expect(access.mayEnter("z1", true, "b", "member")).toBe(false);
    expect(access.mayEnter("z2", true, "a", "member")).toBe(false);
  });

  it("lets the owner into any locked room", () => {
    expect(new ZoneAccess().mayEnter("z1", true, "a", "owner")).toBe(true);
  });

  it("forgets who was let in when the room opens or the person leaves", () => {
    const access = new ZoneAccess();
    access.admit("z1", "a");
    access.admit("z1", "b");
    access.reset("z1");
    expect(access.mayEnter("z1", true, "a", "member")).toBe(false);
    access.admit("z1", "b");
    access.forget("b");
    expect(access.mayEnter("z1", true, "b", "member")).toBe(false);
  });
});

describe("ZoneAccess knocks", () => {
  it("counts one knock at a time per person", () => {
    const access = new ZoneAccess();
    expect(access.startKnock("z1", "a", 0)).toBe(true);
    expect(access.startKnock("z1", "a", 1)).toBe(false);
    expect(access.knockingOn("a")).toBe("z1");
    expect(access.knockersOf("z1")).toEqual(["a"]);
  });

  it("makes them wait before knocking again after an answer", () => {
    const access = new ZoneAccess();
    access.startKnock("z1", "a", 0);
    access.endKnock("a");
    expect(access.startKnock("z1", "a", KNOCK_COOLDOWN_MS - 1)).toBe(false);
    expect(access.startKnock("z1", "a", KNOCK_COOLDOWN_MS)).toBe(true);
  });

  it("drops a knock when the person leaves", () => {
    const access = new ZoneAccess();
    access.startKnock("z1", "a", 0);
    access.forget("a");
    expect(access.knockingOn("a")).toBeUndefined();
    expect(access.startKnock("z1", "a", 1)).toBe(true);
  });
});
