// lib
import { AccessToken, TrackSource } from "livekit-server-sdk";

// shared
import { ROOM_NAME, type VoiceToken } from "@void/shared";

/** One LiveKit room per space, so voice and video never cross from one space into another. */
export const voiceRoomName = (spaceId: string) => `${ROOM_NAME}-${spaceId}`;

export interface VoiceTokenConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export interface VoiceTokenService {
  issue(spaceId: string, identity: string, name: string): Promise<VoiceToken>;
}

// Short TTL: the client asks again on reconnect, so a leaked token expires quickly.
const TOKEN_TTL = "10m";

/** Returns undefined when LiveKit is not configured, so the game still runs without voice. */
export function createVoiceTokenService(config: VoiceTokenConfig): VoiceTokenService | undefined {
  if (!config.url || !config.apiKey || !config.apiSecret) return undefined;

  return {
    async issue(spaceId, identity, name) {
      const token = new AccessToken(config.apiKey, config.apiSecret, {
        identity,
        name,
        ttl: TOKEN_TTL,
      });
      // Scoped to the one room; players publish their own tracks but cannot administer it.
      token.addGrant({
        room: voiceRoomName(spaceId),
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
        // Mic, camera and screen only; a modified client cannot publish anything else.
        canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE],
      });
      return { url: config.url, token: await token.toJwt() };
    },
  };
}
