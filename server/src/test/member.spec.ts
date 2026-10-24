import { describe, expect, it } from "vitest";
import {
  canChangeRole,
  canRemoveMember,
  canRemovePiece,
  type MemberEvent,
  type SpaceRole,
} from "@void/shared";

import { parseRoleChange } from "../common/credentials.js";
import type { SpaceRepository } from "../repositories/space.repository.js";
import { createMemberService } from "../services/member.service.js";

const SPACE = "11111111-1111-4111-8111-111111111111";
const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BOB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function setup() {
  const roles = new Map<string, SpaceRole>([
    [OWNER, "owner"],
    [ADMIN, "admin"],
    [ADA, "member"],
    [BOB, "member"],
  ]);
  const events: MemberEvent[] = [];
  const released: string[] = [];
  const spaces = {
    async findMembership(_space: string, userId: string) {
      const role = roles.get(userId);
      return role && { role, lastX: null, lastY: null };
    },
    async removeMember(_space: string, userId: string) {
      return roles.delete(userId);
    },
    async setRole(_space: string, userId: string, role: SpaceRole) {
      roles.set(userId, role);
      return true;
    },
    async transferOwnership(_space: string, from: string, to: string) {
      roles.set(from, "admin");
      roles.set(to, "owner");
      return true;
    },
  } as unknown as SpaceRepository;
  const service = createMemberService({
    spaces,
    claims: {
      async release(_space, userId) {
        released.push(userId);
        return undefined;
      },
    },
    events: { publish: (_space, event) => void events.push(event) },
  });
  return { service, roles, events, released };
}

describe("canRemoveMember", () => {
  it("lets anyone but the owner leave", () => {
    expect(canRemoveMember("member", "member", true)).toBe(true);
    expect(canRemoveMember("admin", "admin", true)).toBe(true);
    expect(canRemoveMember("owner", "owner", true)).toBe(false);
  });

  it("lets an owner remove anyone else, and an admin only plain members", () => {
    expect(canRemoveMember("owner", "admin", false)).toBe(true);
    expect(canRemoveMember("admin", "member", false)).toBe(true);
    expect(canRemoveMember("admin", "admin", false)).toBe(false);
    expect(canRemoveMember("admin", "owner", false)).toBe(false);
    expect(canRemoveMember("member", "member", false)).toBe(false);
  });
});

describe("canChangeRole", () => {
  it("is for the owner, about someone else, and never about the owner", () => {
    expect(canChangeRole("owner", "member", "admin", false)).toBe(true);
    expect(canChangeRole("owner", "admin", "owner", false)).toBe(true);
    expect(canChangeRole("owner", "member", "admin", true)).toBe(false);
    expect(canChangeRole("owner", "member", "member", false)).toBe(false);
    expect(canChangeRole("admin", "member", "admin", false)).toBe(false);
  });
});

describe("canRemovePiece", () => {
  it("keeps a piece for whoever placed it and for the people who manage the space", () => {
    expect(canRemovePiece("member", "u1", "u1")).toBe(true);
    expect(canRemovePiece("member", "u1", "u2")).toBe(false);
    expect(canRemovePiece("member", "u1", undefined)).toBe(false);
    expect(canRemovePiece("admin", "u1", "u2")).toBe(true);
  });
});

describe("parseRoleChange", () => {
  it("accepts a role and nothing else", () => {
    expect(parseRoleChange({ role: "admin" })).toEqual({ ok: true, value: { role: "admin" } });
    expect(parseRoleChange({ role: "god" }).ok).toBe(false);
    expect(parseRoleChange(null).ok).toBe(false);
  });
});

describe("createMemberService", () => {
  it("lets an admin remove a member, frees their desk and tells the room", async () => {
    const { service, roles, events, released } = setup();
    await service.remove(ADMIN, SPACE, ADA);
    expect(roles.has(ADA)).toBe(false);
    expect(released).toEqual([ADA]);
    expect(events).toEqual([{ kind: "removed", userId: ADA }]);
  });

  it("refuses an admin removing an admin or the owner, and a member removing anyone", async () => {
    const { service, roles } = setup();
    await expect(service.remove(ADMIN, SPACE, OWNER)).rejects.toMatchObject({ status: 403 });
    await expect(service.remove(ADA, SPACE, BOB)).rejects.toMatchObject({ status: 403 });
    expect(roles.size).toBe(4);
  });

  it("lets a member leave but not the owner", async () => {
    const { service, roles } = setup();
    await service.remove(ADA, SPACE, ADA);
    expect(roles.has(ADA)).toBe(false);
    await expect(service.remove(OWNER, SPACE, OWNER)).rejects.toMatchObject({ status: 403 });
  });

  it("tells strangers nothing about the space", async () => {
    const { service } = setup();
    await expect(service.remove("someone-else", SPACE, ADA)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.remove(OWNER, "not-a-uuid", ADA)).rejects.toMatchObject({ status: 403 });
  });

  it("lets only the owner change roles", async () => {
    const { service, roles, events } = setup();
    await service.setRole(OWNER, SPACE, ADA, "admin");
    expect(roles.get(ADA)).toBe("admin");
    expect(events).toEqual([{ kind: "role", userId: ADA, role: "admin" }]);
    await expect(service.setRole(ADMIN, SPACE, BOB, "admin")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("hands the space over, leaving the old owner an admin", async () => {
    const { service, roles, events } = setup();
    await service.setRole(OWNER, SPACE, ADMIN, "owner");
    expect(roles.get(ADMIN)).toBe("owner");
    expect(roles.get(OWNER)).toBe("admin");
    expect(events).toEqual([
      { kind: "role", userId: OWNER, role: "admin" },
      { kind: "role", userId: ADMIN, role: "owner" },
    ]);
  });
});
