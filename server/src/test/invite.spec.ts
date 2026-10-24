import { describe, expect, it } from "vitest";
import type { SpaceRole } from "@void/shared";

import { parseInviteOptions } from "../common/credentials.js";
import type { BanRepository } from "../repositories/ban.repository.js";
import type { InviteRepository, InviteTarget } from "../repositories/invite.repository.js";
import type { SpaceRepository } from "../repositories/space.repository.js";
import { createInviteService, hashCode, hashToken } from "../services/invite.service.js";

const SPACE = "11111111-1111-4111-8111-111111111111";
const INVITE = "22222222-2222-4222-8222-222222222222";
const SECRET = "s".repeat(32);

function setup(roles: Record<string, SpaceRole>) {
  const members = new Map(Object.entries(roles));
  const stored = new Map<string, InviteTarget>();
  const byCode = new Map<string, InviteTarget>();
  const requests: string[] = [];
  const log = { created: 0 };
  const invites: InviteRepository = {
    async create(invite) {
      log.created++;
      const target = {
        id: INVITE,
        spaceId: invite.spaceId,
        spaceName: "Studio",
        requiresApproval: invite.requiresApproval,
      };
      stored.set(invite.tokenHash, target);
      byCode.set(invite.codeHash, target);
      return {
        id: INVITE,
        requiresApproval: invite.requiresApproval,
        expiresAt: null,
        createdAt: "now",
        createdByName: "Ada",
      };
    },
    async countActive() {
      return stored.size;
    },
    async listActive() {
      return [];
    },
    async revoke() {
      return true;
    },
    async findByHash(hash) {
      return stored.get(hash);
    },
    async findByCodeHash(hash) {
      return byCode.get(hash);
    },
    async requestJoin(_space, userId) {
      requests.push(userId);
    },
    async listRequests() {
      return [];
    },
    async decide(_space, userId) {
      return requests.includes(userId);
    },
  };
  const spaces = {
    async findMembership(_space: string, userId: string) {
      const role = members.get(userId);
      return role && { role, lastX: null, lastY: null };
    },
    async findSummary(_space: string, userId: string) {
      const role = members.get(userId);
      return (
        role && {
          id: SPACE,
          name: "Studio",
          template: "office" as const,
          size: "medium" as const,
          role,
        }
      );
    },
    async addMember(_space: string, userId: string) {
      members.set(userId, "member");
    },
  } as unknown as SpaceRepository;
  const banned = new Set<string>();
  const bans = { isBanned: async (_space: string, userId: string) => banned.has(userId) };
  const service = createInviteService(invites, spaces, bans as BanRepository, SECRET);
  return { service, members, requests, byCode, log, banned };
}

const open = { requiresApproval: false, expiresInHours: null };

describe("createInviteService", () => {
  it("lets an owner or admin make a link and returns the token once", async () => {
    const { service } = setup({ owner: "owner", admin: "admin" });
    const made = await service.create("admin", SPACE, open);
    expect(made.token).toHaveLength(43);
    expect(JSON.stringify(await service.list("owner", SPACE))).not.toContain(made.token);
  });

  it("refuses plain members and strangers", async () => {
    const { service } = setup({ member: "member" });
    await expect(service.create("member", SPACE, open)).rejects.toMatchObject({ status: 403 });
    await expect(service.create("stranger", SPACE, open)).rejects.toMatchObject({ status: 403 });
    await expect(service.requests("member", SPACE)).rejects.toMatchObject({ status: 403 });
  });

  it("adds someone who uses an open link", async () => {
    const { service, members } = setup({ owner: "owner" });
    const { token } = await service.create("owner", SPACE, open);
    const result = await service.accept("guest", token);
    expect(result).toMatchObject({ status: "joined" });
    expect(members.get("guest")).toBe("member");
  });

  it("queues someone who uses an approval link, without adding them", async () => {
    const { service, members, requests } = setup({ owner: "owner" });
    const { token } = await service.create("owner", SPACE, { ...open, requiresApproval: true });
    expect(await service.accept("guest", token)).toEqual({
      status: "pending",
      spaceName: "Studio",
    });
    expect(members.has("guest")).toBe(false);
    expect(requests).toEqual(["guest"]);
  });

  it("adds someone who types the join code, in any case and with spaces or a dash", async () => {
    const { service, members } = setup({ owner: "owner" });
    const { code } = await service.create("owner", SPACE, open);
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{10}$/);
    const typed = `${code.slice(0, 5).toLowerCase()} - ${code.slice(5).toLowerCase()}`;
    expect(await service.accept("guest", typed)).toMatchObject({ status: "joined" });
    expect(members.get("guest")).toBe("member");
  });

  it("queues someone who uses the code of an approval invite", async () => {
    const { service, members, requests } = setup({ owner: "owner" });
    const { code } = await service.create("owner", SPACE, { ...open, requiresApproval: true });
    expect(await service.accept("guest", code)).toEqual({ status: "pending", spaceName: "Studio" });
    expect(members.has("guest")).toBe(false);
    expect(requests).toEqual(["guest"]);
  });

  it("keeps only a keyed hash of the code, which a different secret cannot reproduce", async () => {
    const { service, byCode } = setup({ owner: "owner" });
    const { code } = await service.create("owner", SPACE, open);
    expect([...byCode.keys()].some((key) => key.includes(code))).toBe(false);
    expect(byCode.has(hashCode(SECRET, code))).toBe(true);
    expect(byCode.has(hashCode("t".repeat(32), code))).toBe(false);
  });

  it("refuses a code that was never issued", async () => {
    const { service } = setup({ owner: "owner" });
    await expect(service.accept("guest", "AAAAA-AAAAA")).rejects.toMatchObject({ status: 400 });
  });

  it("treats a banned person's link or code like a dead one, and queues no request", async () => {
    const { service, members, requests, banned } = setup({ owner: "owner" });
    const { token, code } = await service.create("owner", SPACE, {
      ...open,
      requiresApproval: true,
    });
    banned.add("guest");
    for (const invite of [token, code]) {
      await expect(service.accept("guest", invite)).rejects.toMatchObject({ status: 400 });
      await expect(service.preview("guest", invite)).rejects.toMatchObject({ status: 400 });
    }
    expect(members.has("guest")).toBe(false);
    expect(requests).toEqual([]);
  });

  it("does not demote or duplicate someone who is already in", async () => {
    const { service, members } = setup({ owner: "owner" });
    const { token } = await service.create("owner", SPACE, open);
    expect(await service.accept("owner", token)).toMatchObject({ status: "joined" });
    expect(members.get("owner")).toBe("owner");
  });

  it("rejects tokens that were never issued or are malformed", async () => {
    const { service } = setup({ owner: "owner" });
    await expect(service.accept("guest", "x".repeat(43))).rejects.toMatchObject({ status: 400 });
    await expect(service.preview("guest", "short")).rejects.toMatchObject({ status: 400 });
  });

  it("lets managers decide a request, once", async () => {
    const { service } = setup({ owner: "owner" });
    const { token } = await service.create("owner", SPACE, { ...open, requiresApproval: true });
    await service.accept("guest", token);
    await expect(service.decide("owner", SPACE, SPACE, true)).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe("hashToken", () => {
  it("is stable and does not contain the token", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toContain("abc");
  });
});

describe("parseInviteOptions", () => {
  it("accepts the two shapes of expiry", () => {
    expect(parseInviteOptions({ requiresApproval: true, expiresInHours: 24 }).ok).toBe(true);
    expect(parseInviteOptions({ requiresApproval: false, expiresInHours: null }).ok).toBe(true);
  });

  it.each([
    null,
    {},
    { requiresApproval: "yes", expiresInHours: 1 },
    { requiresApproval: true },
    { requiresApproval: true, expiresInHours: 0 },
    { requiresApproval: true, expiresInHours: 1.5 },
    { requiresApproval: true, expiresInHours: 99999 },
  ])("rejects %j", (body) => {
    expect(parseInviteOptions(body).ok).toBe(false);
  });
});
