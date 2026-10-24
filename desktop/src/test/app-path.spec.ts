import { describe, expect, it } from "vitest";
import path from "node:path";

import { resolveAppPath } from "../windows/app-path";

const root = path.resolve("/app/client");
const at = (...parts: string[]) => path.join(root, ...parts);

describe("resolveAppPath", () => {
  it("serves the index for the root and files under it", () => {
    expect(resolveAppPath(root, "/")).toBe(at("index.html"));
    expect(resolveAppPath(root, "")).toBe(at("index.html"));
    expect(resolveAppPath(root, "/assets/index-abc.js")).toBe(at("assets", "index-abc.js"));
    expect(resolveAppPath(root, "/maps/office.tmj")).toBe(at("maps", "office.tmj"));
  });

  it("decodes percent escapes", () => {
    expect(resolveAppPath(root, "/a%20b.png")).toBe(at("a b.png"));
  });

  it.each([
    "/../secret",
    "/assets/../../secret",
    "/%2e%2e/secret",
    "/%2e%2e%2fsecret",
    "/a%00b",
    "/%E0%A4%A",
  ])("refuses %s", (pathname) => {
    expect(resolveAppPath(root, pathname)).toBeUndefined();
  });
});
