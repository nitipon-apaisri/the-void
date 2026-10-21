import { describe, expect, it } from "vitest";

import { createPasswordService } from "../services/password.service.js";

const passwords = createPasswordService();

describe("password service", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await passwords.hash("correct horse battery");
    expect(await passwords.verify("correct horse battery", hash)).toBe(true);
    expect(await passwords.verify("wrong", hash)).toBe(false);
  });

  it("salts every hash and never stores the password", async () => {
    const [a, b] = await Promise.all([
      passwords.hash("same password"),
      passwords.hash("same password"),
    ]);
    expect(a).not.toBe(b);
    expect(a).not.toContain("same password");
  });

  it("rejects a hash it cannot read instead of throwing", async () => {
    expect(await passwords.verify("x", "")).toBe(false);
    expect(await passwords.verify("x", "bcrypt$1$2$3$4$5")).toBe(false);
  });
});
