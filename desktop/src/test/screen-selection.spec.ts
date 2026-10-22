import { describe, expect, it } from "vitest";

import { createScreenSelection } from "../ipc/screen-selection";

describe("screen selection", () => {
  it("accepts a source that was offered, once", () => {
    const selection = createScreenSelection();
    selection.offer(["screen:1:0", "window:2:0"]);
    expect(selection.choose("window:2:0")).toBe(true);
    expect(selection.take()).toBe("window:2:0");
    expect(selection.take()).toBeUndefined();
  });

  it("rejects a source that was never offered", () => {
    const selection = createScreenSelection();
    selection.offer(["screen:1:0"]);
    expect(selection.choose("screen:9:0")).toBe(false);
    expect(selection.take()).toBeUndefined();
  });

  it("expires a pick that is not used soon", () => {
    let time = 0;
    const selection = createScreenSelection(() => time);
    selection.offer(["screen:1:0"]);
    selection.choose("screen:1:0");
    time = 31_000;
    expect(selection.take()).toBeUndefined();
  });

  it("forgets a pick when a new list is offered", () => {
    const selection = createScreenSelection();
    selection.offer(["screen:1:0"]);
    selection.choose("screen:1:0");
    selection.offer(["screen:2:0"]);
    expect(selection.take()).toBeUndefined();
    expect(selection.choose("screen:1:0")).toBe(false);
  });
});
