import { describe, expect, it } from "vitest";

import type { NewUser, UserRecord, UserRepository } from "../repositories/user.repository.js";
import { AuthError, createAuthService } from "../services/auth.service.js";
import { createPasswordService } from "../services/password.service.js";
import { createTokenService } from "../services/token.service.js";

function fakeUsers(): UserRepository {
  const byId = new Map<string, UserRecord>();
  const patch = (id: string, fields: Partial<UserRecord>) => {
    const user = byId.get(id);
    if (!user) return undefined;
    const next = { ...user, ...fields };
    byId.set(id, next);
    return next;
  };
  return {
    async create(user: NewUser) {
      if ([...byId.values()].some((u) => u.email === user.email)) return undefined;
      const record: UserRecord = {
        id: `id-${byId.size + 1}`,
        ...user,
        lastX: null,
        lastY: null,
        tokenVersion: 0,
      };
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
    async updateProfile(id, name, look) {
      return patch(id, { name, look });
    },
    async updateEmail(id, email) {
      if ([...byId.values()].some((u) => u.email === email && u.id !== id)) return undefined;
      return patch(id, { email });
    },
    async updatePassword(id, passwordHash) {
      return patch(id, { passwordHash, tokenVersion: (byId.get(id)?.tokenVersion ?? 0) + 1 });
    },
    async bumpTokenVersion(id) {
      return patch(id, { tokenVersion: (byId.get(id)?.tokenVersion ?? 0) + 1 });
    },
    async remove(id) {
      byId.delete(id);
    },
  };
}

const newAuth = () =>
  createAuthService({
    users: fakeUsers(),
    spaces: { handOverOwned: async () => {} },
    passwords: createPasswordService(),
    tokens: createTokenService("s".repeat(32)),
  });

const aliceLook = { body: 2, eyes: 1, outfit: 30, hair: 40, accessory: -1 };
const alice = {
  email: "alice@example.com",
  password: "correct horse",
  name: "Alice",
  look: aliceLook,
};

describe("auth service", () => {
  it("registers, then logs in with the same password", async () => {
    const auth = newAuth();
    const registered = await auth.register(alice);
    expect(registered.user).toEqual({
      id: registered.user.id,
      email: alice.email,
      name: "Alice",
      look: aliceLook,
    });

    const session = await auth.login({ email: alice.email, password: alice.password });
    expect(session.user.id).toBe(registered.user.id);
  });

  it("does not expose the hash in the session", async () => {
    const session = await newAuth().register(alice);
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

  describe("account edits", () => {
    const signedUp = async () => {
      const auth = newAuth();
      const { token } = await auth.register(alice);
      const user = (await auth.authenticate(token))!;
      return { auth, user, token };
    };

    it("updates the name and look", async () => {
      const { auth, user } = await signedUp();
      const newLook = { body: 4, eyes: 3, outfit: 100, hair: 150, accessory: 12 };
      expect(await auth.updateProfile(user, { name: "Al", look: newLook })).toMatchObject({
        name: "Al",
        look: newLook,
      });
    });

    it("needs the current password to change the email or password", async () => {
      const { auth, user } = await signedUp();
      await expect(
        auth.changeEmail(user, { currentPassword: "wrong", email: "new@example.com" }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        auth.changePassword(user, { currentPassword: "wrong", newPassword: "another long one" }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(auth.deleteAccount(user, "wrong")).rejects.toMatchObject({ status: 403 });
    });

    it("refuses an email another account already uses", async () => {
      const { auth, user } = await signedUp();
      await auth.register({ ...alice, email: "bob@example.com", name: "Bob" });
      await expect(
        auth.changeEmail(user, { currentPassword: alice.password, email: "bob@example.com" }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("signs other devices out when the password changes, but keeps this one", async () => {
      const { auth, user, token: oldToken } = await signedUp();
      const fresh = await auth.changePassword(user, {
        currentPassword: alice.password,
        newPassword: "another long one",
      });
      expect(await auth.authenticate(oldToken)).toBeUndefined();
      expect((await auth.authenticate(fresh.token))?.id).toBe(user.id);
      await expect(
        auth.login({ email: alice.email, password: alice.password }),
      ).rejects.toMatchObject({ status: 401 });
      expect(await auth.login({ email: alice.email, password: "another long one" })).toBeDefined();
    });

    it("signs other devices out without changing the password", async () => {
      const { auth, user, token: oldToken } = await signedUp();
      const fresh = await auth.signOutOthers(user);
      expect(await auth.authenticate(oldToken)).toBeUndefined();
      expect((await auth.authenticate(fresh.token))?.id).toBe(user.id);
    });

    it("deletes the account so its token stops working", async () => {
      const { auth, user, token } = await signedUp();
      await auth.deleteAccount(user, alice.password);
      expect(await auth.authenticate(token)).toBeUndefined();
    });
  });
});
