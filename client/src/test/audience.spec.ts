import { describe, expect, it } from "vitest";

import { audienceIds } from "../systems/audience";

const at = (id: string, x: number, zone = "") => ({ id, x, y: 0, zone });
const RADIUS = 100;

describe("audienceIds", () => {
  it("uses distance when nobody is in a room", () => {
    const heard = audienceIds({ x: 0, y: 0, zone: "" }, [at("near", 50), at("far", 500)], RADIUS);
    expect([...heard]).toEqual(["near"]);
  });

  it("puts everyone in the same room in the call, however far apart", () => {
    const heard = audienceIds(
      { x: 0, y: 0, zone: "z1" },
      [at("a", 900, "z1"), at("b", 20, "z1"), at("c", 30, "z2")],
      RADIUS,
    );
    expect([...heard].sort()).toEqual(["a", "b"]);
  });

  it("does not hear someone just outside the wall, nor they us", () => {
    const inside = audienceIds({ x: 0, y: 0, zone: "z1" }, [at("out", 10)], RADIUS);
    const outside = audienceIds({ x: 0, y: 0, zone: "" }, [at("in", 10, "z1")], RADIUS);
    expect(inside.size).toBe(0);
    expect(outside.size).toBe(0);
  });

  it("keeps the hysteresis for people in the open", () => {
    const me = { x: 0, y: 0, zone: "" };
    const edge = [at("a", 110)];
    expect(audienceIds(me, edge, RADIUS).size).toBe(0);
    expect(audienceIds(me, edge, RADIUS, new Set(["a"])).size).toBe(1);
  });

  it("leaves out people on do not disturb, outside a room", () => {
    const busy = { ...at("busy", 10), busy: true };
    expect([...audienceIds({ x: 0, y: 0, zone: "" }, [busy, at("ok", 20)], RADIUS)]).toEqual([
      "ok",
    ]);
    expect(audienceIds({ x: 0, y: 0, zone: "", busy: true }, [at("ok", 20)], RADIUS).size).toBe(0);
  });

  it("still puts a busy person in the call of a room they stand in", () => {
    const heard = audienceIds(
      { x: 0, y: 0, zone: "z1", busy: true },
      [{ ...at("a", 900, "z1"), busy: true }],
      RADIUS,
    );
    expect([...heard]).toEqual(["a"]);
  });
});
