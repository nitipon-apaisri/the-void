import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { VoidRoom } from "./VoidRoom.js";

const port = Number(process.env.PORT ?? 2567);
const gameServer = new Server({ transport: new WebSocketTransport() });
gameServer.define("void", VoidRoom);
gameServer.listen(port).then(() => console.log(`colyseus listening on :${port}`));
