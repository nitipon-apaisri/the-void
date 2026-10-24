// lib
import path from "node:path";

import { matchMaker, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

// shared
import { mapName, memberChannel, ROOM_NAME, SPACE_SIZES, SPACE_TEMPLATES } from "@void/shared";

import { restrictCors } from "./common/cors.js";
import { env } from "./config/env.js";
import { createBanRepository } from "./repositories/ban.repository.js";
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
import { loadCollisionGrid, loadSeats, loadTables, loadZones } from "./services/map.service.js";
import { createPool } from "./services/database.service.js";
import { createInviteService } from "./services/invite.service.js";
import { createMemberService } from "./services/member.service.js";
import { createSpaceService } from "./services/space.service.js";
import { createPasswordService } from "./services/password.service.js";
import { createTokenService } from "./services/token.service.js";
import { createVoiceTokenService } from "./services/voice-token.service.js";

const pool = createPool(env.databaseUrl);
const users = createUserRepository(pool);
const spaces = createSpaceRepository(pool);
const claims = createTableRepository(pool);
const auth = createAuthService({
  users,
  spaces,
  passwords: createPasswordService(),
  tokens: createTokenService(env.authSecret),
});

const spaceService = createSpaceService(spaces);
const bans = createBanRepository(pool);
const inviteService = createInviteService(
  createInviteRepository(pool),
  spaces,
  bans,
  env.authSecret,
);
// The rooms listen on this channel, so a removal or role change reaches someone who is online.
const memberService = createMemberService({
  spaces,
  bans,
  claims,
  events: {
    publish: (spaceId, event) => void matchMaker.presence.publish(memberChannel(spaceId), event),
  },
});
// Read once: a space picks one of these by its template and size, and a bad file should stop
// the start.
const maps: SpaceMaps = Object.fromEntries(
  SPACE_TEMPLATES.flatMap((template) =>
    SPACE_SIZES.map((size) => {
      const name = mapName(template, size);
      const file = path.join(env.mapsDir, `${name}.tmj`);
      return [
        name,
        {
          grid: loadCollisionGrid(file, size),
          tables: loadTables(file),
          seats: loadSeats(file),
          zones: loadZones(file),
        },
      ];
    }),
  ),
);
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
    mountSpaceRoutes(app, {
      ...routeOptions,
      spaces: spaceService,
      invites: inviteService,
      members: memberService,
    });
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
