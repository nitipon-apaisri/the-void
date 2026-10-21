// lib
import { Room, type Client } from "@colyseus/core";

// shared
import { MAX_CLIENTS, MESSAGES, SPAWN, type JoinOptions } from "@void/shared";

import type { VoiceTokenService } from "../../services/voice-token.service.js";
import { sanitizeAvatar, sanitizeName } from "./handlers/join.handler.js";
import { parseMove } from "./handlers/move.handler.js";
import { Player, VoidState } from "./void.state.js";

interface VoidRoomOptions {
  voiceTokens?: VoiceTokenService;
}

export class VoidRoom extends Room<{ state: VoidState }> {
  maxClients = MAX_CLIENTS;

  onCreate(options: VoidRoomOptions) {
    this.setState(new VoidState());
    // Only joined players can ask, and the identity is their session id, never client-supplied.
    this.onMessage(MESSAGES.VOICE_TOKEN, async (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) throw new Error("not joined");
      if (!options.voiceTokens) throw new Error("voice unavailable");
      return options.voiceTokens.issue(client.sessionId, player.name);
    });
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
