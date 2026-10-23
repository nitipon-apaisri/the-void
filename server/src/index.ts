// lib
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

// shared
import { ROOM_NAME } from "@void/shared";

import { restrictCors } from "./common/cors.js";
import { env } from "./config/env.js";
import { createSpaceRepository } from "./repositories/space.repository.js";
import { createUserRepository } from "./repositories/user.repository.js";
import { VoidRoom } from "./rooms/void/void.room.js";
import { mountAuthRoutes } from "./routes/auth.routes.js";
import { mountSpaceRoutes } from "./routes/space.routes.js";
import { createAuthService } from "./services/auth.service.js";
import { loadCollisionGrid } from "./services/map.service.js";
import { createPool } from "./services/database.service.js";
import { createSpaceService } from "./services/space.service.js";
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

const spaces = createSpaceRepository(pool);
const spaceService = createSpaceService(spaces);
// Read once: the map is shared by every space for now, and a bad file should stop the start.
const grid = loadCollisionGrid(env.mapFile);

const voiceTokens = createVoiceTokenService(env.livekit);
if (!voiceTokens) console.warn("LiveKit is not configured; voice and video are disabled");

restrictCors(env.corsOrigins);

const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    mountAuthRoutes(app, {
      auth,
      corsOrigins: env.corsOrigins,
      trustProxyHops: env.trustProxyHops,
    });
    mountSpaceRoutes(app, { auth, spaces: spaceService, corsOrigins: env.corsOrigins });
  },
});
// One room per space: players with the same `spaceId` option land in the same room.
gameServer
  .define(ROOM_NAME, VoidRoom, { voiceTokens, auth, users, spaces, grid })
  .filterBy(["spaceId"]);
gameServer.onShutdown(() => pool.end());
gameServer.listen(env.port).then(() => console.log(`colyseus listening on :${env.port}`));
