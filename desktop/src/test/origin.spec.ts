import { describe, expect, it } from "vitest";

import { APP_ORIGIN, originOf } from "../origin";

describe("originOf", () => {
  it("knows our own pages and http(s) origins", () => {
    expect(originOf("app://void/")).toBe(APP_ORIGIN);
    expect(originOf("app://void/assets/index.js")).toBe(APP_ORIGIN);
    expect(originOf("http://localhost:5173/x?y=1")).toBe("http://localhost:5173");
    expect(originOf("https://void.example.com")).toBe("https://void.example.com");
  });

  it("does not let another app host, or an opaque origin, pass for ours", () => {
    expect(originOf("app://evil/")).toBeUndefined();
    expect(originOf("file:///etc/passwd")).toBeUndefined();
    expect(originOf("data:text/html,hi")).toBeUndefined();
    expect(originOf("about:blank")).toBeUndefined();
    expect(originOf("not a url")).toBeUndefined();
    expect(originOf("")).toBeUndefined();
  });
});
