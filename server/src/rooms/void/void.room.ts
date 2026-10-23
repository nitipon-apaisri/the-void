// lib
import { Room, ServerError, type Client } from "@colyseus/core";

// shared
import {
  encodeLook,
  MAX_CLIENTS,
  MESSAGES,
  type CollisionGrid,
  type JoinOptions,
  type Look,
  type SpaceRole,
} from "@void/shared";

import { isUuid, type SpaceRepository } from "../../repositories/space.repository.js";
import type { UserRepository } from "../../repositories/user.repository.js";
import type { AuthService } from "../../services/auth.service.js";
import type { VoiceTokenService } from "../../services/voice-token.service.js";
import { resolveSpawn } from "./handlers/join.handler.js";
import { acceptMove, MoveBudget, parseMove } from "./handlers/move.handler.js";
import { Player, VoidState } from "./void.state.js";

interface VoidRoomOptions {
  auth: AuthService;
  users: UserRepository;
  spaces: SpaceRepository;
  grid: CollisionGrid;
  voiceTokens?: VoiceTokenService;
}

const REFRESH_MS = 1000;

/** What onAuth hands to onJoin and onLeave through `client.auth`. */
interface Account {
  userId: string;
  name: string;
  look: Look;
  role: SpaceRole;
  lastX: number | null;
  lastY: number | null;
}

/** One room per space: the client's `spaceId` join option picks it (see `filterBy`). */
export class VoidRoom extends Room<{ state: VoidState }> {
  maxClients = MAX_CLIENTS;
  private options!: VoidRoomOptions;
  private spaceId = "";
  private readonly lastRefresh = new Map<string, number>();
  private readonly budgets = new Map<string, MoveBudget>();

  onCreate(options: VoidRoomOptions & Partial<JoinOptions>) {
    // A made-up id would otherwise leave an empty room behind until it times out.
    if (!isUuid(options.spaceId)) throw new ServerError(400, "unknown space");
    this.spaceId = options.spaceId;
    this.options = options;
    this.setState(new VoidState());
    // Only joined players can ask, and the identity is their session id, never client-supplied.
    this.onMessage(MESSAGES.VOICE_TOKEN, async (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) throw new Error("not joined");
      if (!options.voiceTokens) throw new Error("voice unavailable");
      return options.voiceTokens.issue(this.spaceId, client.sessionId, player.name);
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
      player.look = encodeLook(user.look);
    });
    this.onMessage(MESSAGES.MOVE, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      const budget = this.budgets.get(client.sessionId);
      const pos = parseMove(payload);
      if (!player || !budget || !pos) return;
      if (!acceptMove(options.grid, budget, player, pos, Date.now())) {
        // Walls and walking speed are the server's call: put the client back where we have them.
        client.send(MESSAGES.SNAP, { x: player.x, y: player.y });
        return;
      }
      player.x = pos.x;
      player.y = pos.y;
    });
  }

  // Who you are comes from the signed token, and whether you may be here from the member list.
  async onAuth(_client: Client, options: Partial<JoinOptions> | undefined): Promise<Account> {
    const user = await this.options.auth.authenticate(options?.token);
    if (!user) throw new ServerError(401, "not signed in");
    const membership = await this.options.spaces.findMembership(this.spaceId, user.id);
    if (!membership) throw new ServerError(403, "you are not in this space");
    return {
      userId: user.id,
      name: user.name,
      look: user.look,
      role: membership.role,
      lastX: membership.lastX,
      lastY: membership.lastY,
    };
  }

  onJoin(client: Client<{ auth: Account }>) {
    // onAuth always ran first; this only narrows the type.
    if (!client.auth) throw new ServerError(401, "not signed in");
    const { userId, name, look, lastX, lastY } = client.auth;
    const player = new Player();
    player.userId = userId;
    player.name = name;
    player.look = encodeLook(look);
    const spawn = resolveSpawn(lastX, lastY, this.options.grid);
    player.x = spawn.x;
    player.y = spawn.y;
    this.state.players.set(client.sessionId, player);
    this.budgets.set(client.sessionId, new MoveBudget(Date.now()));
  }

  async onLeave(client: Client<{ auth: Account }>) {
    const player = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.lastRefresh.delete(client.sessionId);
    this.budgets.delete(client.sessionId);
    if (!player || !client.auth) return;
    try {
      await this.options.spaces.savePosition(this.spaceId, client.auth.userId, player.x, player.y);
    } catch (err) {
      console.error("could not save position", err instanceof Error ? err.message : err);
    }
  }
}
