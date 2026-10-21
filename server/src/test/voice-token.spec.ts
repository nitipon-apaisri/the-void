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

  it("issues a token for the given identity, scoped to one room", async () => {
    const { url, token } = await createVoiceTokenService(config)!.issue("session-1", "Ada");
    const claims = claimsOf(token);
    expect(url).toBe(config.url);
    expect(claims.sub).toBe("session-1");
    expect(claims.name).toBe("Ada");
    expect(claims.video).toMatchObject({ room: "void", roomJoin: true, canPublish: true });
    expect(claims.video.roomAdmin).toBeUndefined();
    expect(claims.exp - claims.nbf).toBeLessThanOrEqual(600);
  });
});
