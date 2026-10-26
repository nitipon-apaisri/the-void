import { describe, expect, it } from "vitest";

import type { SpaceLink, SpaceRole } from "@void/shared";

import type { LinkRepository } from "../repositories/link.repository.js";
import type { SpaceRepository } from "../repositories/space.repository.js";
import { AuthError } from "../services/auth.service.js";
import { hashCode } from "../services/invite.service.js";
import { createLinkService } from "../services/link.service.js";

const SECRET = "test-secret";
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const OWNER = "00000000-0000-4000-8000-0000000000f1";
const LINK = "00000000-0000-4000-8000-0000000000c1";

function setup(role: SpaceRole | undefined = "owner") {
  const state = { codes: new Map<string, string>(), live: [] as { a: string; b: string }[] };
  const links = {
    async setConnectCode(spaceId: string, hash: string) {
      state.codes.set(hash, spaceId);
    },
    async findByConnectCode(hash: string) {
      const id = state.codes.get(hash);
      return id ? { id, name: "Other" } : undefined;
    },
    async countLive() {
      return state.live.length;
    },
    async request(a: string, b: string) {
      if (state.live.length > 0) return false;
      state.live.push({ a, b });
      return true;
    },
    async list(): Promise<SpaceLink[]> {
      return [];
    },
    async approve(_space: string, linkId: string) {
      return linkId === LINK;
    },
    async end(_space: string, linkId: string) {
      return linkId === LINK;
    },
  } as unknown as LinkRepository;
  const spaces = {
    async findMembership() {
      return role && { role, lastX: null, lastY: null };
    },
  } as unknown as SpaceRepository;
  const service = createLinkService({
    links,
    spaces,
    secret: SECRET,
  });
  return { service, state };
}

describe("link service", () => {
  it("lets only an owner manage links", async () => {
    for (const role of ["admin", "member", undefined] as const) {
      const { service } = setup(role);
      await expect(service.connectCode(OWNER, A)).rejects.toBeInstanceOf(AuthError);
      await expect(service.request(OWNER, A, "K7M2P9QXA4")).rejects.toBeInstanceOf(AuthError);
      await expect(service.end(OWNER, A, LINK)).rejects.toBeInstanceOf(AuthError);
    }
  });

  it("lets an admin read the list but not a plain member", async () => {
    await expect(setup("admin").service.list(OWNER, A)).resolves.toEqual([]);
    await expect(setup("member").service.list(OWNER, A)).rejects.toBeInstanceOf(AuthError);
  });

  it("stores only a hash of the connect code", async () => {
    const { service, state } = setup();
    const { code } = await service.connectCode(OWNER, A);
    expect(state.codes.get(hashCode(SECRET, code))).toBe(A);
    expect([...state.codes.keys()]).not.toContain(code);
  });

  it("asks for a link with a code typed in any case", async () => {
    const { service, state } = setup();
    state.codes.set(hashCode(SECRET, "K7M2P9QXA4"), B);
    await service.request(OWNER, A, "k7m2p-9qxa4");
    expect(state.live).toEqual([{ a: A, b: B }]);
  });

  it("refuses an unknown code, the space's own code and a repeat", async () => {
    const { service, state } = setup();
    await expect(service.request(OWNER, A, "K7M2P9QXA4")).rejects.toThrow("not valid");
    state.codes.set(hashCode(SECRET, "K7M2P9QXA4"), A);
    await expect(service.request(OWNER, A, "K7M2P9QXA4")).rejects.toThrow("own code");
    state.codes.set(hashCode(SECRET, "K7M2P9QXA4"), B);
    await service.request(OWNER, A, "K7M2P9QXA4");
    await expect(service.request(OWNER, A, "K7M2P9QXA4")).rejects.toThrow("already linked");
  });

  it("ends a link for the owner of either side", async () => {
    const { service } = setup();
    await service.end(OWNER, A, LINK);
  });

  it("refuses to end or approve a link that is not there", async () => {
    const { service } = setup();
    await expect(service.end(OWNER, A, "nope")).rejects.toThrow("already gone");
    await expect(service.approve(OWNER, A, "nope")).rejects.toThrow("already handled");
    await service.approve(OWNER, A, LINK);
  });
});
