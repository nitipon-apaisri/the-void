// lib
import path from "node:path";

import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

// shared
import { ROOM_NAME, SPACE_TEMPLATES } from "@void/shared";

import { restrictCors } from "./common/cors.js";
import { env } from "./config/env.js";
import { createInviteRepository } from "./repositories/invite.repository.js";
import { createSpaceRepository } from "./repositories/space.repository.js";
import { createFurnitureRepository } from "./repositories/furniture.repository.js";
import { createTableRepository } from "./repositories/table.repository.js";
import { createUserRepository } from "./repositories/user.repository.js";
import { VoidRoom, type SpaceMaps } from "./rooms/void/void.room.js";
import { mountAuthRoutes } from "./routes/auth.routes.js";
import { mountInviteRoutes } from "./routes/invite.routes.js";
import { mountSpaceRoutes } from "./routes/space.routes.js";
import { createAuthService } from "./services/auth.service.js";
import { loadCollisionGrid, loadSeats, loadTables } from "./services/map.service.js";
import { createPool } from "./services/database.service.js";
import { createInviteService } from "./services/invite.service.js";
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
const inviteService = createInviteService(createInviteRepository(pool), spaces);
// Read once: a space picks one of these by its template, and a bad file should stop the start.
const maps = Object.fromEntries(
  SPACE_TEMPLATES.map((template) => {
    const file = path.join(env.mapsDir, `${template}.tmj`);
    return [
      template,
      { grid: loadCollisionGrid(file), tables: loadTables(file), seats: loadSeats(file) },
    ];
  }),
) as SpaceMaps;
const claims = createTableRepository(pool);
const furniture = createFurnitureRepository(pool);

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
    const routeOptions = { auth, corsOrigins: env.corsOrigins };
    mountSpaceRoutes(app, { ...routeOptions, spaces: spaceService, invites: inviteService });
    mountInviteRoutes(app, { ...routeOptions, invites: inviteService });
  },
});
// One room per space: players with the same `spaceId` option land in the same room.
gameServer
  .define(ROOM_NAME, VoidRoom, {
    voiceTokens,
    auth,
    users,
    spaces,
    maps,
    claims,
    furniture,
  })
  .filterBy(["spaceId"]);
gameServer.onShutdown(() => pool.end());
gameServer.listen(env.port).then(() => console.log(`colyseus listening on :${env.port}`));
