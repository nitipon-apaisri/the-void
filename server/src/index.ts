// lib
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

// shared
import { ROOM_NAME } from "@void/shared";

import { env } from "./config/env.js";
import { VoidRoom } from "./rooms/void/void.room.js";
import { createVoiceTokenService } from "./services/voice-token.service.js";

const voiceTokens = createVoiceTokenService(env.livekit);
if (!voiceTokens) console.warn("LiveKit is not configured; voice and video are disabled");

const gameServer = new Server({ transport: new WebSocketTransport() });
gameServer.define(ROOM_NAME, VoidRoom, { voiceTokens });
gameServer.listen(env.port).then(() => console.log(`colyseus listening on :${env.port}`));
