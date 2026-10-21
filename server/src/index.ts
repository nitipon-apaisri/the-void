// lib
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

// shared
import { ROOM_NAME } from "@void/shared";

import { restrictCors } from "./common/cors.js";
import { env } from "./config/env.js";
import { createUserRepository } from "./repositories/user.repository.js";
import { VoidRoom } from "./rooms/void/void.room.js";
import { mountAuthRoutes } from "./routes/auth.routes.js";
import { createAuthService } from "./services/auth.service.js";
import { createPool } from "./services/database.service.js";
import { createPasswordService } from "./services/password.service.js";
import { createTokenService } from "./services/token.service.js";
import { createVoiceTokenService } from "./services/voice-token.service.js";

const pool = createPool(env.databaseUrl);
const users = createUserRepository(pool);
const auth = createAuthService({
  users,
  passwords: createPasswordService(),
  tokens: createTokenService(env.authSecret),
});

const voiceTokens = createVoiceTokenService(env.livekit);
if (!voiceTokens) console.warn("LiveKit is not configured; voice and video are disabled");

restrictCors(env.corsOrigins);

const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app) =>
    mountAuthRoutes(app, {
      auth,
      corsOrigins: env.corsOrigins,
      trustProxyHops: env.trustProxyHops,
    }),
});
gameServer.define(ROOM_NAME, VoidRoom, { voiceTokens, auth, users });
gameServer.onShutdown(() => pool.end());
gameServer.listen(env.port).then(() => console.log(`colyseus listening on :${env.port}`));
