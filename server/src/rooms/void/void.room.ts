// lib
import { Room, type Client } from "@colyseus/core";

// shared
import { MAX_CLIENTS, MESSAGES, SPAWN, type JoinOptions } from "@void/shared";

import { sanitizeAvatar, sanitizeName } from "./handlers/join.handler.js";
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
    player.avatar = sanitizeAvatar(options?.avatar);
    player.x = SPAWN.x;
    player.y = SPAWN.y;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }
}
