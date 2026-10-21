import { describe, expect, it } from "vitest";

import type { NewUser, UserRecord, UserRepository } from "../repositories/user.repository.js";
import { AuthError, createAuthService } from "../services/auth.service.js";
import { createPasswordService } from "../services/password.service.js";
import { createTokenService } from "../services/token.service.js";

function fakeUsers(): UserRepository {
  const byId = new Map<string, UserRecord>();
  return {
    async create(user: NewUser) {
      if ([...byId.values()].some((u) => u.email === user.email)) return undefined;
      const record: UserRecord = { id: `id-${byId.size + 1}`, ...user, lastX: null, lastY: null };
      byId.set(record.id, record);
      return record;
    },
    async findByEmail(email) {
      return [...byId.values()].find((u) => u.email === email);
    },
    async findById(id) {
      return byId.get(id);
    },
    async savePosition() {},
  };
}

const newAuth = () =>
  createAuthService({
    users: fakeUsers(),
    passwords: createPasswordService(),
    tokens: createTokenService("s".repeat(32)),
  });

const alice = { email: "alice@example.com", password: "correct horse", name: "Alice", avatar: 2 };

describe("auth service", () => {
  it("registers, then logs in with the same password", async () => {
    const auth = newAuth();
    const registered = await auth.register(alice);
    expect(registered.user).toEqual({ id: registered.user.id, name: "Alice", avatar: 2 });

    const session = await auth.login({ email: alice.email, password: alice.password });
    expect(session.user.id).toBe(registered.user.id);
  });

  it("does not expose the email or hash in the session", async () => {
    const session = await newAuth().register(alice);
    expect(JSON.stringify(session)).not.toContain(alice.email);
    expect(JSON.stringify(session)).not.toContain("scrypt");
  });

  it("rejects a duplicate email with 409", async () => {
    const auth = newAuth();
    await auth.register(alice);
    await expect(auth.register(alice)).rejects.toMatchObject({ status: 409 });
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const auth = newAuth();
    await auth.register(alice);
    const wrong = await auth.login({ email: alice.email, password: "nope" }).catch((e) => e);
    const unknown = await auth.login({ email: "x@example.com", password: "nope" }).catch((e) => e);
    expect(wrong).toBeInstanceOf(AuthError);
    expect(unknown).toBeInstanceOf(AuthError);
    expect(wrong.status).toBe(401);
    expect(wrong.message).toBe(unknown.message);
  });

  it("authenticates a session token and rejects garbage", async () => {
    const auth = newAuth();
    const { token, user } = await auth.register(alice);
    expect((await auth.authenticate(token))?.id).toBe(user.id);
    expect(await auth.authenticate("garbage")).toBeUndefined();
    expect(await auth.authenticate(undefined)).toBeUndefined();
  });
});
