import { describe, expect, it, vi } from "vitest";

import { trayMenuTemplate } from "../windows/tray-menu";

const actions = () => ({ open: vi.fn(), quit: vi.fn(), setStatus: vi.fn() });

describe("trayMenuTemplate", () => {
  it("ticks only the current status", () => {
    const radios = trayMenuTemplate("away", actions()).filter((i) => i.type === "radio");
    expect(radios.map((i) => [i.label, i.checked])).toEqual([
      ["Available", false],
      ["Away", true],
      ["Do not disturb", false],
    ]);
  });

  it("wires open, status and quit", () => {
    const a = actions();
    const items = trayMenuTemplate("available", a);
    const find = (label: string) => items.find((i) => i.label === label);
    find("Open The Void")?.click?.(undefined as never, undefined, undefined as never);
    find("Do not disturb")?.click?.(undefined as never, undefined, undefined as never);
    find("Quit The Void")?.click?.(undefined as never, undefined, undefined as never);
    expect(a.open).toHaveBeenCalledOnce();
    expect(a.setStatus).toHaveBeenCalledWith("busy");
    expect(a.quit).toHaveBeenCalledOnce();
  });
});
