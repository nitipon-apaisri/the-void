import { describe, expect, it } from "vitest";

import { createVoiceTokenService } from "../services/voice-token.service.js";

const config = {
  url: "ws://livekit.test",
  apiKey: "key",
  apiSecret: "secret-secret-secret-secret-secret-1234",
};

const claimsOf = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString());

describe("createVoiceTokenService", () => {
  it("is undefined when LiveKit is not configured", () => {
    expect(createVoiceTokenService({ ...config, url: "" })).toBeUndefined();
    expect(createVoiceTokenService({ ...config, apiKey: "" })).toBeUndefined();
    expect(createVoiceTokenService({ ...config, apiSecret: "" })).toBeUndefined();
  });

  it("gives each space its own room", async () => {
    const service = createVoiceTokenService(config)!;
    const a = claimsOf((await service.issue("space-a", "s", "Ada")).token);
    const b = claimsOf((await service.issue("space-b", "s", "Ada")).token);
    expect(a.video.room).not.toBe(b.video.room);
  });

  it("issues a token for the given identity, scoped to one room", async () => {
    const { url, token } = await createVoiceTokenService(config)!.issue(
      "space-1",
      "session-1",
      "Ada",
    );
    const claims = claimsOf(token);
    expect(url).toBe(config.url);
    expect(claims.sub).toBe("session-1");
    expect(claims.name).toBe("Ada");
    expect(claims.video).toMatchObject({ room: "void-space-1", roomJoin: true, canPublish: true });
    expect(claims.video.roomAdmin).toBeUndefined();
    expect(claims.video.canPublishData).toBe(false);
    expect(claims.video.canPublishSources).toHaveLength(4);
    expect(claims.video.canPublishSources).toContain("screen_share");
    expect(claims.video.canPublishSources).toContain("screen_share_audio");
    expect(claims.exp - claims.nbf).toBeLessThanOrEqual(600);
  });
});
