// lib
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";

import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

// shared
import { mapName, ROOM_NAME, SPACE_SIZES, SPACE_TEMPLATES, DEFAULT_LOOK } from "@void/shared";

import { VoidRoom, type SpaceMaps } from "../../server/src/rooms/void/void.room.js";
import {
  loadCollisionGrid,
  loadSeats,
  loadTables,
  loadZones,
} from "../../server/src/services/map.service.js";
import type { AuthService } from "../../server/src/services/auth.service.js";
import type { SpaceRepository } from "../../server/src/repositories/space.repository.js";
import type { UserRecord, UserRepository } from "../../server/src/repositories/user.repository.js";
import { type ServerMessage, type ServerStats } from "./config.js";

// The real room and handlers run here; only what is behind them (accounts and the database) is
// faked, so a run needs no Postgres and leaves nothing behind.
const size = (process.env.LOAD_SIZE ?? "medium") as (typeof SPACE_SIZES)[number];
const template = (process.env.LOAD_TEMPLATE ?? "office") as (typeof SPACE_TEMPLATES)[number];
const mapsDir = path.resolve(import.meta.dirname, "../../client/src/assets/maps");

const maps: SpaceMaps = {};
for (const t of SPACE_TEMPLATES) {
  for (const s of SPACE_SIZES) {
    if (t !== template || s !== size) continue;
    const file = path.join(mapsDir, `${mapName(t, s)}.tmj`);
    maps[mapName(t, s)] = {
      grid: loadCollisionGrid(file, s),
      tables: loadTables(file),
      seats: loadSeats(file),
      zones: loadZones(file),
    };
  }
}

const user = (token: string): UserRecord => ({
  id: token,
  email: `${token}@load.invalid`,
  passwordHash: "",
  name: token,
  look: DEFAULT_LOOK,
  lastX: null,
  lastY: null,
  tokenVersion: 0,
});

// A token is the bot's name, so the server never has to verify anything.
const auth = {
  authenticate: async (token: unknown) => (typeof token === "string" ? user(token) : undefined),
} as unknown as AuthService;

// `wss` is protected; this only lets the stats read its sockets.
class MeteredTransport extends WebSocketTransport {
  get sockets() {
    return this.wss.clients;
  }
}

const transport = new MeteredTransport();
const gameServer = new Server({ transport });
gameServer
  .define(ROOM_NAME, VoidRoom, {
    auth,
    maps,
    users: { findById: async (id: string) => user(id) } as unknown as UserRepository,
    spaces: {
      findLayout: async () => ({ template, size }),
      findMembership: async () => ({ role: "member", lastX: null, lastY: null }),
      savePosition: async () => {},
      setTemplate: async () => {},
    } as unknown as SpaceRepository,
    claims: {
      listClaims: async () => [],
      claim: async () => true,
      release: async () => undefined,
    },
    furniture: {
      list: async () => [],
      add: async () => "0",
      remove: async () => true,
      clear: async () => {},
    },
  })
  .filterBy(["spaceId"]);

const send = (message: ServerMessage) => process.send?.(message);

// The ws sockets know how many bytes crossed them; summing gives the bandwidth without a probe
// on the wire.
function socketBytes() {
  let out = 0;
  let inn = 0;
  for (const ws of transport.sockets) {
    const socket = (ws as unknown as { _socket?: { bytesWritten: number; bytesRead: number } })
      ._socket;
    out += socket?.bytesWritten ?? 0;
    inn += socket?.bytesRead ?? 0;
  }
  return { out, inn };
}

await gameServer.listen(Number(process.env.PORT ?? 0));
const address = transport.server?.address();
const port = typeof address === "object" && address ? address.port : Number(process.env.PORT);
send({ type: "ready", port });

const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
let lastCpu = process.cpuUsage();
let lastAt = process.hrtime.bigint();
// Sockets that closed take their counts with them, so keep a running total that never falls.
let bytesOut = 0;
let bytesIn = 0;
let seenOut = 0;
let seenIn = 0;
setInterval(() => {
  const now = process.hrtime.bigint();
  const cpu = process.cpuUsage();
  const elapsedUs = Number(now - lastAt) / 1000;
  const usedUs = cpu.user + cpu.system - lastCpu.user - lastCpu.system;
  lastCpu = cpu;
  lastAt = now;
  const { out, inn } = socketBytes();
  bytesOut += Math.max(0, out - seenOut);
  bytesIn += Math.max(0, inn - seenIn);
  seenOut = out;
  seenIn = inn;
  const stats: ServerStats = {
    clients: transport.sockets.size,
    cpuPercent: (usedUs / elapsedUs) * 100,
    loopP99Ms: loop.percentile(99) / 1e6,
    loopMaxMs: loop.max / 1e6,
    rssMb: process.memoryUsage().rss / 1024 / 1024,
    bytesOut,
    bytesIn,
  };
  loop.reset();
  send({ type: "stats", stats });
}, 1000);
