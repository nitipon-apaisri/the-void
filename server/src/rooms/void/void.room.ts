// lib
import { Room, ServerError, type Client } from "@colyseus/core";

// shared
import {
  canDecorate,
  encodeLook,
  findFurniture,
  MAX_FURNITURE,
  PLAYER_RADIUS,
  placementError,
  setBlocked,
  MAX_CLIENTS,
  MESSAGES,
  type ClaimTablePayload,
  type CollisionGrid,
  type JoinOptions,
  type Look,
  type MapTable,
  type WavedPayload,
  type SpaceRole,
} from "@void/shared";

import { isUuid, type SpaceRepository } from "../../repositories/space.repository.js";
import type { FurnitureRepository } from "../../repositories/furniture.repository.js";
import type { TableRepository } from "../../repositories/table.repository.js";
import type { UserRepository } from "../../repositories/user.repository.js";
import type { AuthService } from "../../services/auth.service.js";
import type { VoiceTokenService } from "../../services/voice-token.service.js";
import { resolveSpawn } from "./handlers/join.handler.js";
import { acceptMove, MoveBudget, parseMove } from "./handlers/move.handler.js";
import { parsePlace, parseRemove } from "./handlers/furniture.handler.js";
import { checkClaim, parseClaim } from "./handlers/table.handler.js";
import { canWave, parseWave } from "./handlers/wave.handler.js";
import { Furniture, Player, TableClaim, VoidState } from "./void.state.js";

interface VoidRoomOptions {
  auth: AuthService;
  users: UserRepository;
  spaces: SpaceRepository;
  grid: CollisionGrid;
  tables: MapTable[];
  claims: TableRepository;
  furniture: FurnitureRepository;
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
  // This space's own copy of the walls: placed furniture changes it.
  private grid!: CollisionGrid;
  private readonly lastRefresh = new Map<string, number>();
  private readonly budgets = new Map<string, MoveBudget>();
  private readonly lastWave = new Map<string, number>();

  async onCreate(options: VoidRoomOptions & Partial<JoinOptions>) {
    // A made-up id would otherwise leave an empty room behind until it times out.
    if (!isUuid(options.spaceId)) throw new ServerError(400, "unknown space");
    this.spaceId = options.spaceId;
    this.options = options;
    this.setState(new VoidState());
    this.grid = { ...options.grid, blocked: [...options.grid.blocked] };
    for (const piece of await options.furniture.list(this.spaceId)) {
      const item = findFurniture(piece.itemId);
      if (!item) continue;
      this.state.furniture.set(piece.id, this.toFurniture(piece.itemId, piece.col, piece.row));
      setBlocked(this.grid, item, piece.col, piece.row, true);
    }
    for (const claim of await options.claims.listClaims(this.spaceId)) {
      // A claim on a desk the map no longer has stays in the database but is not shown.
      if (!options.tables.some((t) => t.id === claim.tableId)) continue;
      this.state.tables.set(claim.tableId, this.toClaim(claim.userId, claim.name));
    }
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
      for (const claim of this.state.tables.values()) {
        if (claim.userId === account.userId) claim.name = user.name;
      }
    });
    // Only the two people involved hear about it; nothing is kept in room state.
    this.onMessage(MESSAGES.WAVE, (client, payload: unknown) => {
      const request = parseWave(payload);
      const from = this.state.players.get(client.sessionId);
      const to = request && this.state.players.get(request.targetId);
      const now = Date.now();
      if (!request || !from || !to) return;
      const self = request.targetId === client.sessionId;
      if (!canWave(from, to, self, now, this.lastWave.get(client.sessionId))) return;
      this.lastWave.set(client.sessionId, now);
      const waved: WavedPayload = {
        fromId: client.sessionId,
        toId: request.targetId,
        name: from.name,
      };
      client.send(MESSAGES.WAVED, waved);
      this.clients.getById(request.targetId)?.send(MESSAGES.WAVED, waved);
    });
    this.onMessage(MESSAGES.PLACE_FURNITURE, async (client, payload: unknown) => {
      const account = (client as Client<{ auth: Account }>).auth;
      const request = parsePlace(payload);
      if (!account || !canDecorate(account.role))
        throw new Error("only owners and admins can decorate");
      if (!request) throw new Error("invalid request");
      if (this.state.furniture.size >= MAX_FURNITURE)
        throw new Error("the space is full of furniture");
      const { item, col, row } = request;
      const error = this.placementError(item, col, row);
      if (error) throw new Error(error);
      const id = await options.furniture.add(this.spaceId, item.id, col, row, account.userId);
      // Someone else may have placed something here while the database was working.
      const late = this.placementError(item, col, row);
      if (late) {
        await options.furniture.remove(this.spaceId, id);
        throw new Error(late);
      }
      setBlocked(this.grid, item, col, row, true);
      this.state.furniture.set(id, this.toFurniture(item.id, col, row));
      return true;
    });
    this.onMessage(MESSAGES.REMOVE_FURNITURE, async (client, payload: unknown) => {
      const account = (client as Client<{ auth: Account }>).auth;
      const request = parseRemove(payload);
      if (!account || !canDecorate(account.role))
        throw new Error("only owners and admins can decorate");
      const piece = request && this.state.furniture.get(request.id);
      if (!request || !piece) throw new Error("that piece is gone");
      await options.furniture.remove(this.spaceId, request.id);
      const item = findFurniture(piece.itemId);
      if (item) setBlocked(this.grid, item, piece.col, piece.row, false);
      this.state.furniture.delete(request.id);
      return true;
    });
    this.onMessage(MESSAGES.CLAIM_TABLE, async (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      const request: ClaimTablePayload | null = parseClaim(payload);
      if (!player || !request) throw new Error("invalid request");
      const check = checkClaim(
        options.tables,
        this.state.tables,
        player.userId,
        request.tableId,
        player,
      );
      if (!check.ok) throw new Error(check.error);
      if (!(await options.claims.claim(this.spaceId, request.tableId, player.userId))) {
        throw new Error("that desk is taken");
      }
      this.state.tables.set(request.tableId, this.toClaim(player.userId, player.name));
      return true;
    });
    this.onMessage(MESSAGES.UNCLAIM_TABLE, async (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) throw new Error("not joined");
      const tableId = await options.claims.release(this.spaceId, player.userId);
      if (tableId) this.state.tables.delete(tableId);
      return true;
    });
    this.onMessage(MESSAGES.MOVE, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      const budget = this.budgets.get(client.sessionId);
      const pos = parseMove(payload);
      if (!player || !budget || !pos) return;
      if (!acceptMove(this.grid, budget, player, pos, Date.now())) {
        // Walls and walking speed are the server's call: put the client back where we have them.
        client.send(MESSAGES.SNAP, { x: player.x, y: player.y });
        return;
      }
      player.x = pos.x;
      player.y = pos.y;
    });
  }

  private placementError(
    item: NonNullable<ReturnType<typeof findFurniture>>,
    col: number,
    row: number,
  ) {
    return placementError(this.grid, item, col, row, {
      people: [...this.state.players.values()],
      personRadius: PLAYER_RADIUS,
      tables: this.options.tables,
    });
  }

  private toFurniture(itemId: string, col: number, row: number) {
    const piece = new Furniture();
    piece.itemId = itemId;
    piece.col = col;
    piece.row = row;
    return piece;
  }

  private toClaim(userId: string, name: string) {
    const claim = new TableClaim();
    claim.userId = userId;
    claim.name = name;
    return claim;
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
    const spawn = resolveSpawn(lastX, lastY, this.grid);
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
    this.lastWave.delete(client.sessionId);
    if (!player || !client.auth) return;
    try {
      await this.options.spaces.savePosition(this.spaceId, client.auth.userId, player.x, player.y);
    } catch (err) {
      console.error("could not save position", err instanceof Error ? err.message : err);
    }
  }
}
