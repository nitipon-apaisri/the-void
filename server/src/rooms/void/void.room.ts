// lib
import { Room, ServerError, type Client } from "@colyseus/core";

// shared
import { MAX_CLIENTS, MESSAGES, type JoinOptions } from "@void/shared";

import type { UserRepository } from "../../repositories/user.repository.js";
import type { AuthService } from "../../services/auth.service.js";
import type { VoiceTokenService } from "../../services/voice-token.service.js";
import { resolveSpawn } from "./handlers/join.handler.js";
import { parseMove } from "./handlers/move.handler.js";
import { Player, VoidState } from "./void.state.js";

interface VoidRoomOptions {
  auth: AuthService;
  users: UserRepository;
  voiceTokens?: VoiceTokenService;
}

const REFRESH_MS = 1000;

/** What onAuth hands to onJoin and onLeave through `client.auth`. */
interface Account {
  userId: string;
  name: string;
  avatar: number;
  lastX: number | null;
  lastY: number | null;
}

export class VoidRoom extends Room<{ state: VoidState }> {
  maxClients = MAX_CLIENTS;
  private options!: VoidRoomOptions;
  private readonly lastRefresh = new Map<string, number>();

  onCreate(options: VoidRoomOptions) {
    this.options = options;
    this.setState(new VoidState());
    // Only joined players can ask, and the identity is their session id, never client-supplied.
    this.onMessage(MESSAGES.VOICE_TOKEN, async (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) throw new Error("not joined");
      if (!options.voiceTokens) throw new Error("voice unavailable");
      return options.voiceTokens.issue(client.sessionId, player.name);
    });
    // The edit itself happened over HTTP; this only copies the stored result into room state.
    this.onMessage(MESSAGES.REFRESH_PROFILE, async (client) => {
      const player = this.state.players.get(client.sessionId);
      const account = (client as Client<{ auth: Account }>).auth;
      const now = Date.now();
      // One database read per message, so a client spamming it cannot turn into read load.
      if (!player || !account || now - (this.lastRefresh.get(client.sessionId) ?? 0) < REFRESH_MS) {
        return;
      }
      this.lastRefresh.set(client.sessionId, now);
      const user = await options.users.findById(account.userId);
      if (!user) return;
      player.name = user.name;
      player.avatar = user.avatar;
    });
    this.onMessage(MESSAGES.MOVE, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      const pos = parseMove(payload);
      if (!player || !pos) return;
      player.x = pos.x;
      player.y = pos.y;
    });
  }

  // Who you are comes from the signed token, so a client cannot pick or spoof a name.
  async onAuth(_client: Client, options: Partial<JoinOptions> | undefined): Promise<Account> {
    const user = await this.options.auth.authenticate(options?.token);
    if (!user) throw new ServerError(401, "not signed in");
    return {
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
      lastX: user.lastX,
      lastY: user.lastY,
    };
  }

  onJoin(client: Client<{ auth: Account }>) {
    // onAuth always ran first; this only narrows the type.
    if (!client.auth) throw new ServerError(401, "not signed in");
    const { name, avatar, lastX, lastY } = client.auth;
    const player = new Player();
    player.name = name;
    player.avatar = avatar;
    const spawn = resolveSpawn(lastX, lastY);
    player.x = spawn.x;
    player.y = spawn.y;
    this.state.players.set(client.sessionId, player);
  }

  async onLeave(client: Client<{ auth: Account }>) {
    const player = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.lastRefresh.delete(client.sessionId);
    if (!player || !client.auth) return;
    try {
      await this.options.users.savePosition(client.auth.userId, player.x, player.y);
    } catch (err) {
      console.error("could not save position", err instanceof Error ? err.message : err);
    }
  }
}
