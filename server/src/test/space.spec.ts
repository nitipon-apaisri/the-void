import { describe, expect, it } from "vitest";
import { MAX_OWNED_SPACES, MAX_SPACE_NAME_LENGTH, type SpaceMember } from "@void/shared";

import { parseSpace } from "../common/credentials.js";
import { isUuid, type SpaceRepository } from "../repositories/space.repository.js";
import { AuthError } from "../services/auth.service.js";
import { createSpaceService } from "../services/space.service.js";

const SPACE_ID = "11111111-1111-4111-8111-111111111111";

function fakeSpaces(owned = 0, members = new Set<string>()): SpaceRepository {
  const list: SpaceMember[] = [
    { userId: "u1", name: "Ada", look: undefined as never, role: "owner" },
  ];
  return {
    async create(name, _ownerId, template) {
      return { id: SPACE_ID, name, role: "owner", template };
    },
    async findTemplate() {
      return "office";
    },
    async setTemplate() {},
    async countOwned() {
      return owned;
    },
    async listForUser() {
      return [];
    },
    async findMembership(spaceId, userId) {
      return members.has(`${spaceId}:${userId}`)
        ? { role: "member", lastX: null, lastY: null }
        : undefined;
    },
    async listMembers() {
      return list;
    },
    async savePosition() {},
    async addMember() {},
    async findSummary() {
      return undefined;
    },
  };
}

describe("parseSpace", () => {
  it("trims the name", () => {
    expect(parseSpace({ name: "  Studio " })).toEqual({ ok: true, value: { name: "Studio" } });
  });

  it("accepts a known template and rejects an unknown one", () => {
    expect(parseSpace({ name: "A", template: "studio" })).toEqual({
      ok: true,
      value: { name: "A", template: "studio" },
    });
    expect(parseSpace({ name: "A", template: "castle" }).ok).toBe(false);
  });

  it.each([
    null,
    {},
    { name: "" },
    { name: "   " },
    { name: 5 },
    { name: "x".repeat(MAX_SPACE_NAME_LENGTH + 1) },
  ])("rejects %j", (body) => {
    expect(parseSpace(body).ok).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts a uuid and nothing else", () => {
    expect(isUuid(SPACE_ID)).toBe(true);
    expect(isUuid("1; drop table t_users")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("createSpaceService", () => {
  it("creates a space for its owner", async () => {
    const space = await createSpaceService(fakeSpaces()).create("u1", { name: "Studio" });
    expect(space).toMatchObject({ name: "Studio", role: "owner" });
  });

  it("stops at the limit of owned spaces", async () => {
    const service = createSpaceService(fakeSpaces(MAX_OWNED_SPACES));
    await expect(service.create("u1", { name: "One more" })).rejects.toBeInstanceOf(AuthError);
  });

  it("lists members only to members", async () => {
    const service = createSpaceService(fakeSpaces(0, new Set([`${SPACE_ID}:u1`])));
    await expect(service.members("u1", SPACE_ID)).resolves.toHaveLength(1);
    await expect(service.members("u2", SPACE_ID)).rejects.toMatchObject({ status: 403 });
    await expect(service.members("u1", "not-a-uuid")).rejects.toMatchObject({ status: 403 });
  });
});
