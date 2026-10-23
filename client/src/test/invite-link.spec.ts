import { describe, expect, it } from "vitest";

import { buildInviteLink, parseInviteToken } from "../utils/invite-link";

const TOKEN = "FRKyrOXovnQiEvSPfF-0RLjyCpq3OfYFR5J0RSgBGFo";

describe("parseInviteToken", () => {
  it("reads a well-formed token", () => {
    expect(parseInviteToken(`?invite=${TOKEN}`)).toBe(TOKEN);
    expect(parseInviteToken(`?a=1&invite=${TOKEN}`)).toBe(TOKEN);
  });

  it.each(["", "?invite=", "?invite=short", "?invite=has spaces in it, not a token!!", "?other=1"])(
    "ignores %j",
    (search) => {
      expect(parseInviteToken(search)).toBeUndefined();
    },
  );
});

describe("buildInviteLink", () => {
  it("puts the token in the query and keeps the rest of the address clean", () => {
    const link = buildInviteLink("http://localhost:5173/app?x=1#top", TOKEN);
    expect(link).toBe(`http://localhost:5173/app?invite=${TOKEN}`);
    expect(parseInviteToken(new URL(link).search)).toBe(TOKEN);
  });
});
