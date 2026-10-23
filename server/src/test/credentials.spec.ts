import { describe, expect, it } from "vitest";
import {
  LOOK_COUNTS,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@void/shared";

import {
  normalizeEmail,
  parseDeletion,
  parseEmailChange,
  parseLogin,
  parsePasswordChange,
  parseProfile,
  parseRegistration,
} from "../common/credentials.js";

const valid = {
  email: "  Alice@Example.com ",
  password: "a".repeat(MIN_PASSWORD_LENGTH),
  name: "  Alice ",
  look: { body: 1, eyes: 1, outfit: 1, hair: 1, accessory: -1 },
};

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });

  it.each(["", "no-at-sign", "a@b", "a b@c.com", 5, null, undefined, `${"a".repeat(250)}@b.co`])(
    "rejects %j",
    (value) => {
      expect(normalizeEmail(value)).toBeUndefined();
    },
  );
});

describe("parseRegistration", () => {
  it("accepts a valid body and normalizes it", () => {
    expect(parseRegistration(valid)).toEqual({
      ok: true,
      value: {
        email: "alice@example.com",
        password: valid.password,
        name: "Alice",
        look: valid.look,
      },
    });
  });

  it("drops fields it does not know", () => {
    const result = parseRegistration({ ...valid, role: "admin" });
    expect(result.ok && "role" in result.value).toBe(false);
  });

  it.each([null, "x", [], 5])("rejects a non-object body %j", (body) => {
    expect(parseRegistration(body).ok).toBe(false);
  });

  it("rejects a short or oversized password", () => {
    expect(parseRegistration({ ...valid, password: "a".repeat(MIN_PASSWORD_LENGTH - 1) }).ok).toBe(
      false,
    );
    expect(parseRegistration({ ...valid, password: "a".repeat(MAX_PASSWORD_LENGTH + 1) }).ok).toBe(
      false,
    );
  });

  it("rejects an empty or oversized name", () => {
    expect(parseRegistration({ ...valid, name: "   " }).ok).toBe(false);
    expect(parseRegistration({ ...valid, name: "a".repeat(MAX_NAME_LENGTH + 1) }).ok).toBe(false);
  });

  it.each([
    [{ ...valid.look, body: -1 }],
    [{ ...valid.look, body: LOOK_COUNTS.body }],
    [{ ...valid.look, outfit: 1.5 }],
    [{ ...valid.look, hair: "1" }],
    [{ ...valid.look, accessory: -2 }],
    [{ ...valid.look, accessory: LOOK_COUNTS.accessory }],
    [{ ...valid.look, extra: 1 }],
    [{ body: 0, eyes: 0, outfit: 0, hair: 0 }],
    [null],
    [undefined],
  ])("rejects look %j", (look) => {
    expect(parseRegistration({ ...valid, look }).ok).toBe(false);
  });
});

describe("parseLogin", () => {
  it("accepts any password length up to the cap, so the policy is not revealed", () => {
    expect(parseLogin({ email: "a@b.co", password: "x" }).ok).toBe(true);
  });

  it("rejects a bad email, a missing password and an oversized password", () => {
    expect(parseLogin({ email: "nope", password: "x" }).ok).toBe(false);
    expect(parseLogin({ email: "a@b.co" }).ok).toBe(false);
    expect(parseLogin({ email: "a@b.co", password: "x".repeat(MAX_PASSWORD_LENGTH + 1) }).ok).toBe(
      false,
    );
  });
});

describe("account edit parsers", () => {
  it("parseProfile trims the name and checks the look", () => {
    expect(parseProfile({ name: " Al ", look: valid.look })).toEqual({
      ok: true,
      value: { name: "Al", look: valid.look },
    });
    expect(parseProfile({ name: "", look: valid.look }).ok).toBe(false);
    expect(parseProfile({ name: "Al", look: { ...valid.look, eyes: LOOK_COUNTS.eyes } }).ok).toBe(
      false,
    );
    expect(parseProfile({ name: "x".repeat(MAX_NAME_LENGTH + 1), look: valid.look }).ok).toBe(
      false,
    );
  });

  it("parsePasswordChange applies the password policy to the new password only", () => {
    const longEnough = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(parsePasswordChange({ currentPassword: "old", newPassword: longEnough }).ok).toBe(true);
    expect(parsePasswordChange({ currentPassword: "old", newPassword: "short" }).ok).toBe(false);
    expect(parsePasswordChange({ currentPassword: "", newPassword: longEnough }).ok).toBe(false);
    expect(
      parsePasswordChange({
        currentPassword: "old",
        newPassword: "a".repeat(MAX_PASSWORD_LENGTH + 1),
      }).ok,
    ).toBe(false);
  });

  it("parseEmailChange normalises the email", () => {
    expect(parseEmailChange({ currentPassword: "pw", email: " Bob@Example.com " })).toEqual({
      ok: true,
      value: { currentPassword: "pw", email: "bob@example.com" },
    });
    expect(parseEmailChange({ currentPassword: "pw", email: "nope" }).ok).toBe(false);
  });

  it("parseDeletion needs a password", () => {
    expect(parseDeletion({ password: "pw" }).ok).toBe(true);
    expect(parseDeletion({}).ok).toBe(false);
    expect(parseDeletion(null).ok).toBe(false);
  });
});
