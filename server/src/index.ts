// lib
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

// shared
import { ROOM_NAME } from "@void/shared";

import { env } from "./config/env.js";
import { VoidRoom } from "./rooms/void/void.room.js";

const gameServer = new Server({ transport: new WebSocketTransport() });
gameServer.define(ROOM_NAME, VoidRoom);
gameServer.listen(env.port).then(() => console.log(`colyseus listening on :${env.port}`));
