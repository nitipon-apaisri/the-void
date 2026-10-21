import { describe, expect, it } from "vitest";
import {
  AVATAR_COLORS,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@void/shared";

import { normalizeEmail, parseLogin, parseRegistration } from "../common/credentials.js";

const valid = {
  email: "  Alice@Example.com ",
  password: "a".repeat(MIN_PASSWORD_LENGTH),
  name: "  Alice ",
  avatar: 1,
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
      value: { email: "alice@example.com", password: valid.password, name: "Alice", avatar: 1 },
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

  it.each([-1, AVATAR_COLORS.length, 1.5, "1", null, undefined])("rejects avatar %j", (avatar) => {
    expect(parseRegistration({ ...valid, avatar }).ok).toBe(false);
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
