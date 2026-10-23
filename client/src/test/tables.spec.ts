import { describe, expect, it } from "vitest";
import type { MapTable } from "@void/shared";

import { tablePrompt, type Claim } from "../systems/tables";

const table = (id: string, x: number): MapTable => ({
  id,
  name: `Desk ${id}`,
  x,
  y: 0,
  width: 128,
  height: 128,
});
const tables = [table("1", 0), table("2", 400)];
const near1 = { x: 60, y: 60 };

describe("tablePrompt", () => {
  it("offers nothing away from every desk", () => {
    expect(tablePrompt(tables, new Map(), "me", { x: 260, y: 60 })).toBeUndefined();
  });

  it("offers to claim a free desk", () => {
    expect(tablePrompt(tables, new Map(), "me", near1)).toEqual({
      kind: "claim",
      table: tables[0],
    });
  });

  it("offers to release your own desk", () => {
    const claims = new Map<string, Claim>([["1", { userId: "me", name: "Me" }]]);
    expect(tablePrompt(tables, claims, "me", near1)).toEqual({ kind: "release", table: tables[0] });
  });

  it("names the owner of someone else's desk", () => {
    const claims = new Map<string, Claim>([["1", { userId: "you", name: "Mia" }]]);
    expect(tablePrompt(tables, claims, "me", near1)).toEqual({
      kind: "taken",
      table: tables[0],
      owner: "Mia",
    });
  });

  it("does not offer a second desk", () => {
    const claims = new Map<string, Claim>([["2", { userId: "me", name: "Me" }]]);
    expect(tablePrompt(tables, claims, "me", near1)).toEqual({
      kind: "has-desk",
      table: tables[0],
    });
  });
});
