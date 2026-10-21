// lib
import { Room, type Client } from "@colyseus/core";

// shared
import { MAX_CLIENTS, MESSAGES, type JoinOptions } from "@void/shared";

import { sanitizeName } from "./handlers/join.handler.js";
import { parseMove } from "./handlers/move.handler.js";
import { Player, VoidState } from "./void.state.js";

export class VoidRoom extends Room<{ state: VoidState }> {
  maxClients = MAX_CLIENTS;

  onCreate() {
    this.setState(new VoidState());
    this.onMessage(MESSAGES.MOVE, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      const pos = parseMove(payload);
      if (!player || !pos) return;
      player.x = pos.x;
      player.y = pos.y;
    });
  }

  onJoin(client: Client, options: JoinOptions) {
    const player = new Player();
    player.name = sanitizeName(options?.name);
    player.x = 400;
    player.y = 300;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }
}
