// lib
import { Room, ServerError, type Client } from "@colyseus/core";

// shared
import {
  canEmptySpace,
  canModerateMember,
  canRemovePiece,
  DEFAULT_SIZE,
  DEFAULT_TEMPLATE,
  encodeLook,
  findFurniture,
  mapName,
  MAX_FURNITURE,
  PLAYER_RADIUS,
  placementError,
  setBlocked,
  MAX_CLIENTS,
  memberChannel,
  MESSAGES,
  type ClaimTablePayload,
  type CollisionGrid,
  type MemberEvent,
  type JoinOptions,
  type Look,
  furnitureSeats,
  nearestFreeSeat,
  type MapTable,
  type MapZone,
  zoneAt,
  zoneError,
  canManageZones,
  KNOCK_TIMEOUT_MS,
  canEnterLockedZone,
  type KnockOutcome,
  type KnockPayload,
  type KnockResultPayload,
  MAX_CUSTOM_ZONES,
  SPACE_SIZE_DIMENSIONS,
  TILE_SIZE,
  type Position,
  type Seat,
  type WavedPayload,
  type SpaceRole,
} from "@void/shared";

import { isUuid, type SpaceRepository } from "../../repositories/space.repository.js";
import type { FurnitureRepository } from "../../repositories/furniture.repository.js";
import type { ZoneRepository } from "../../repositories/zone.repository.js";
import type { TableRepository } from "../../repositories/table.repository.js";
import type { UserRepository } from "../../repositories/user.repository.js";
import type { AuthService } from "../../services/auth.service.js";
import type { VoiceTokenService } from "../../services/voice-token.service.js";
import { resolveSpawn } from "./handlers/join.handler.js";
import { acceptMove, MoveBudget, parseMove } from "./handlers/move.handler.js";
import { parseSit, pickStandSpot } from "./handlers/seat.handler.js";
import { parsePlace, parseRemove } from "./handlers/furniture.handler.js";
import { checkClaim, parseClaim } from "./handlers/table.handler.js";
import { canWave, parseWave } from "./handlers/wave.handler.js";
import { ZoneAccess } from "./handlers/zone-access.js";
import {
  parseAddZone,
  parseAnswerKnock,
  parseLockZone,
  parseModerate,
  parsePresent,
  presenterIn,
  parseRemoveZone,
} from "./handlers/zone.handler.js";
import { Furniture, Player, TableClaim, VoidState, Zone } from "./void.state.js";

/** What the server reads from a template's map file. */
interface SpaceMap {
  grid: CollisionGrid;
  tables: MapTable[];
  seats: Seat[];
  zones: MapZone[];
}
/** Keyed by `mapName(template, size)`. */
export type SpaceMaps = Record<string, SpaceMap>;

interface VoidRoomOptions {
  auth: AuthService;
  users: UserRepository;
  spaces: SpaceRepository;
  maps: SpaceMaps;
  claims: TableRepository;
  furniture: FurnitureRepository;
  zones: ZoneRepository;
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
  private map!: SpaceMap;
  private grid!: CollisionGrid;
  private readonly lastRefresh = new Map<string, number>();
  private readonly budgets = new Map<string, MoveBudget>();
  // Who sits where, and where they stood before, so standing up can put them back.
  private readonly seated = new Map<string, { seat: Seat; before: Position }>();
  private readonly lastWave = new Map<string, number>();
  private readonly access = new ZoneAccess();
  // The rooms as a list, rebuilt only when one is added or removed (moves read it every step).
  private zoneCache: MapZone[] | undefined;
  // Who placed each piece (by piece id); a piece from before this was recorded has no entry.
  private readonly placedBy = new Map<string, string>();
  private readonly onMemberEvent = (event: MemberEvent) => this.applyMemberEvent(event);

  async onCreate(options: VoidRoomOptions & Partial<JoinOptions>) {
    // A made-up id would otherwise leave an empty room behind until it times out.
    if (!isUuid(options.spaceId)) throw new ServerError(400, "unknown space");
    this.spaceId = options.spaceId;
    this.options = options;
    this.setState(new VoidState());
    // A space that has no template on record (or one this build lacks) gets the classic office.
    const layout = await options.spaces.findLayout(this.spaceId);
    const name = mapName(layout?.template ?? DEFAULT_TEMPLATE, layout?.size ?? DEFAULT_SIZE);
    this.map = options.maps[name]!;
    this.grid = { ...this.map.grid, blocked: [...this.map.grid.blocked] };
    for (const piece of await options.furniture.list(this.spaceId)) {
      const item = findFurniture(piece.itemId);
      if (!item) continue;
      this.state.furniture.set(piece.id, this.toFurniture(piece.itemId, piece.col, piece.row));
      if (piece.placedBy) this.placedBy.set(piece.id, piece.placedBy);
      setBlocked(this.grid, item, piece.col, piece.row, true);
    }
    for (const claim of await options.claims.listClaims(this.spaceId)) {
      // A claim on a desk the map no longer has stays in the database but is not shown.
      if (!this.map.tables.some((t) => t.id === claim.tableId)) continue;
      this.state.tables.set(claim.tableId, this.toClaim(claim.userId, claim.name));
    }
    for (const z of this.map.zones) this.putZone(z.id, this.toZone(z));
    // Rooms drawn in this space, read by the room's own size so one that no longer fits is dropped.
    const dims = SPACE_SIZE_DIMENSIONS[layout?.size ?? DEFAULT_SIZE];
    for (const z of await options.zones.list(this.spaceId)) {
      if (zoneError(z, this.zoneList(), dims.cols, dims.rows)) continue;
      this.putZone(z.id, this.toZone(this.fromStored(z), true));
    }
    this.answer(MESSAGES.ADD_ZONE, async (client, payload: unknown) => {
      const account = (client as Client<{ auth: Account }>).auth;
      const request = parseAddZone(payload);
      if (!account || !request) throw new Error("invalid request");
      if (!canManageZones(account.role)) throw new Error("only owners and admins can draw rooms");
      const custom = [...this.state.zones.values()].filter((z) => z.custom).length;
      if (custom >= MAX_CUSTOM_ZONES) throw new Error("the space has too many private rooms");
      const error = zoneError(request, this.zoneList(), dims.cols, dims.rows);
      if (error) throw new Error(error);
      const name = this.nextZoneName();
      const id = await options.zones.add(this.spaceId, name, request, account.userId);
      // Someone else may have drawn a room here while the database was working.
      const late = zoneError(request, this.zoneList(), dims.cols, dims.rows);
      if (late) {
        await options.zones.remove(this.spaceId, id);
        throw new Error(late);
      }
      this.putZone(id, this.toZone(this.fromStored({ id, name, ...request }), true));
      this.relocateAll();
      return true;
    });
    this.answer(MESSAGES.REMOVE_ZONE, async (client, payload: unknown) => {
      const account = (client as Client<{ auth: Account }>).auth;
      const request = parseRemoveZone(payload);
      if (!account || !request) throw new Error("invalid request");
      if (!canManageZones(account.role)) throw new Error("only owners and admins can remove rooms");
      // The template's rooms are part of the map; only the ones drawn here can go.
      if (!this.state.zones.get(request.id)?.custom) throw new Error("that room is gone");
      await options.zones.remove(this.spaceId, request.id);
      this.dropZone(request.id);
      this.relocateAll();
      return true;
    });
    this.answer(MESSAGES.LOCK_ZONE, (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      const account = (client as Client<{ auth: Account }>).auth;
      const request = parseLockZone(payload);
      const zone = request && this.state.zones.get(request.id);
      if (!player || !account || !request || !zone) throw new Error("that room is gone");
      if (player.zone !== request.id && !canEnterLockedZone(account.role)) {
        throw new Error("you have to be in the room to lock it");
      }
      zone.locked = request.locked;
      if (!request.locked) this.openZone(request.id);
      return true;
    });
    this.answer(MESSAGES.PRESENT, (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      const request = parsePresent(payload);
      if (!player || !request) throw new Error("invalid request");
      if (request.on) {
        const other = presenterIn(this.state.players.values(), player.zone, player);
        if (other) throw new Error(`${other} is already presenting here`);
      }
      player.presenting = request.on;
      return true;
    });
    this.answer(MESSAGES.MODERATE, (client, payload: unknown) => {
      const actor = this.state.players.get(client.sessionId);
      const account = (client as Client<{ auth: Account }>).auth;
      const request = parseModerate(payload);
      if (!actor || !account || !request) throw new Error("invalid request");
      const target = this.clients.find(
        (c) => (c as Client<{ auth: Account }>).auth?.userId === request.userId,
      );
      const targetAccount = (target as Client<{ auth: Account }> | undefined)?.auth;
      const victim = target && this.state.players.get(target.sessionId);
      if (!target || !targetAccount || !victim) throw new Error("that person is not here");
      if (!canModerateMember(account.role, targetAccount.role)) throw new Error("not allowed");
      // The mic itself is theirs: this only asks their client to switch it off.
      if (request.action === "stop-presenting") victim.presenting = false;
      target.send(MESSAGES.MODERATED, { action: request.action, by: actor.name });
      return true;
    });
    this.answer(MESSAGES.ANSWER_KNOCK, (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      const request = parseAnswerKnock(payload);
      const zoneId = request && this.access.knockingOn(request.knockerId);
      if (!player || !request || !zoneId) throw new Error("nobody is knocking");
      if (player.zone !== zoneId) throw new Error("you are not in that room");
      this.closeKnock(request.knockerId, zoneId, request.allow ? "allowed" : "denied");
      return true;
    });
    // Only joined players can ask, and the identity is their session id, never client-supplied.
    this.answer(MESSAGES.VOICE_TOKEN, async (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) throw new Error("not joined");
      if (!options.voiceTokens) throw new Error("voice unavailable");
      return options.voiceTokens.issue(this.spaceId, client.sessionId, player.name);
    });
    // The edit itself happened over HTTP; this only copies the stored result into room state.
    this.answer(MESSAGES.REFRESH_PROFILE, async (client) => {
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
    this.answer(MESSAGES.WAVE, (client, payload: unknown) => {
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
    this.answer(MESSAGES.SIT, (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      const request = parseSit(payload);
      if (!player || !request) throw new Error("invalid request");
      if (this.seated.has(client.sessionId)) throw new Error("you are already sitting");
      const seat = this.allSeats().find((s) => s.id === request.seatId);
      if (!seat) throw new Error("that seat does not exist");
      const taken = new Set([...this.seated.values()].map((s) => s.seat.id));
      if (taken.has(seat.id)) throw new Error("someone is sitting there");
      // The same reach rule the client uses to offer the seat.
      if (nearestFreeSeat([seat], taken, player)?.id !== seat.id) throw new Error("move closer");
      const room = zoneAt(this.zoneList(), seat);
      if (room && room !== player.zone && !this.mayEnter(client, room)) {
        throw new Error("that room is locked");
      }
      this.seated.set(client.sessionId, { seat, before: { x: player.x, y: player.y } });
      this.place(client, player, seat, seat);
      return true;
    });
    this.answer(MESSAGES.STAND, (client) => {
      this.standUp(client.sessionId, client);
      return true;
    });
    this.answer(MESSAGES.PLACE_FURNITURE, async (client, payload: unknown) => {
      const account = (client as Client<{ auth: Account }>).auth;
      const request = parsePlace(payload);
      if (!account || !request) throw new Error("invalid request");
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
      this.placedBy.set(id, account.userId);
      return true;
    });
    this.answer(MESSAGES.REMOVE_FURNITURE, async (client, payload: unknown) => {
      const account = (client as Client<{ auth: Account }>).auth;
      const request = parseRemove(payload);
      if (!account) throw new Error("not joined");
      const piece = request && this.state.furniture.get(request.id);
      if (!request || !piece) throw new Error("that piece is gone");
      if (!canRemovePiece(account.role, account.userId, this.placedBy.get(request.id))) {
        throw new Error("only the person who placed it, an owner or an admin can remove it");
      }
      await options.furniture.remove(this.spaceId, request.id);
      // Whoever sits on a chair that goes away is put back on their feet.
      for (const [sessionId, { seat }] of this.seated) {
        if (seat.id === `f${request.id}`) this.standUp(sessionId);
      }
      const item = findFurniture(piece.itemId);
      if (item) setBlocked(this.grid, item, piece.col, piece.row, false);
      this.state.furniture.delete(request.id);
      this.placedBy.delete(request.id);
      return true;
    });
    this.answer(MESSAGES.CLEAR_FURNITURE, async (client) => {
      const account = (client as Client<{ auth: Account }>).auth;
      if (!account || !canEmptySpace(account.role)) {
        throw new Error("only owners and admins can empty the space");
      }
      await options.furniture.clear(this.spaceId);
      for (const [id, piece] of Array.from(this.state.furniture.entries())) {
        for (const [sessionId, { seat }] of this.seated) {
          if (seat.id === `f${id}`) this.standUp(sessionId);
        }
        const item = findFurniture(piece.itemId);
        if (item) setBlocked(this.grid, item, piece.col, piece.row, false);
        this.state.furniture.delete(id);
      }
      this.placedBy.clear();
      // The map's own furniture is baked into the template, so emptying the space means moving
      // it to the empty template. This room still holds the old map: close it and let clients
      // rejoin a fresh one.
      await options.spaces.setTemplate(this.spaceId, "empty");
      this.broadcast(MESSAGES.SPACE_RESET);
      this.clock.setTimeout(() => void this.disconnect(), 500);
      return true;
    });
    this.answer(MESSAGES.CLAIM_TABLE, async (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      const request: ClaimTablePayload | null = parseClaim(payload);
      if (!player || !request) throw new Error("invalid request");
      const check = checkClaim(
        this.map.tables,
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
    this.answer(MESSAGES.UNCLAIM_TABLE, async (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) throw new Error("not joined");
      const tableId = await options.claims.release(this.spaceId, player.userId);
      if (tableId) this.state.tables.delete(tableId);
      return true;
    });
    this.onMessage(MESSAGES.MOVE, (client, payload) => {
      const player = this.state.players.get(client.sessionId);
      const budget = this.budgets.get(client.sessionId);
      const pos = parseMove(payload, this.grid);
      if (!player || !budget || !pos) return;
      if (this.seated.has(client.sessionId)) {
        // Sitting: the client should have asked to stand first; keep it where it is.
        client.send(MESSAGES.SNAP, { x: player.x, y: player.y });
        return;
      }
      const target = zoneAt(this.zoneList(), pos);
      if (target && target !== player.zone && !this.mayEnter(client, target)) {
        // A locked room: the same as a wall, and the people inside hear someone knock.
        this.refuseEntry(client, player, target);
        return;
      }
      if (!acceptMove(this.grid, budget, player, pos, Date.now())) {
        // Walls and walking speed are the server's call: put the client back where we have them.
        client.send(MESSAGES.SNAP, { x: player.x, y: player.y });
        return;
      }
      player.x = pos.x;
      player.y = pos.y;
      this.setZone(player, zoneAt(this.zoneList(), pos));
    });
    // Removals and role changes happen over HTTP; this is how the people already in hear of them.
    await this.presence.subscribe(memberChannel(this.spaceId), this.onMemberEvent);
  }

  async onDispose() {
    await this.presence.unsubscribe(memberChannel(this.spaceId), this.onMemberEvent);
  }

  private applyMemberEvent(event: MemberEvent) {
    const gone: Client[] = [];
    for (const client of this.clients) {
      const account = (client as Client<{ auth: Account }>).auth;
      if (account?.userId !== event.userId) continue;
      if (event.kind === "role") {
        // Takes effect on the next action they try, without a rejoin.
        account.role = event.role;
        continue;
      }
      gone.push(client);
      client.send(MESSAGES.REMOVED);
      // Leave a moment for the message to arrive before the socket closes.
      this.clock.setTimeout(() => client.leave(), 300);
    }
    if (event.kind === "removed") {
      for (const [id, claim] of Array.from(this.state.tables.entries())) {
        if (claim.userId === event.userId) this.state.tables.delete(id);
      }
    }
    this.broadcast(MESSAGES.MEMBERS_CHANGED, undefined, { except: gone });
  }

  /**
   * A message that a client may ask for a reply to (`room.request`). A thrown error is the
   * reply there; sent as a plain message nothing catches it and it would end the server process.
   */
  private answer(type: string, handler: (client: Client, payload: unknown) => unknown) {
    this.onMessage(type, async (client, payload: unknown, ctx?: { id?: unknown }) => {
      try {
        return await handler(client, payload);
      } catch (err) {
        if (ctx?.id !== undefined) throw err;
        return undefined;
      }
    });
  }

  private allSeats(): Seat[] {
    const pieces = [...this.state.furniture.entries()].map(([id, f]) => ({
      id,
      itemId: f.itemId,
      col: f.col,
      row: f.row,
    }));
    return [...this.map.seats, ...furnitureSeats(pieces)];
  }

  private zoneList(): MapZone[] {
    this.zoneCache ??= [...this.state.zones.entries()].map(([id, z]) => ({
      id,
      name: z.name,
      x: z.x,
      y: z.y,
      width: z.width,
      height: z.height,
    }));
    return this.zoneCache;
  }

  private putZone(id: string, zone: Zone) {
    this.state.zones.set(id, zone);
    this.zoneCache = undefined;
  }

  private dropZone(id: string) {
    this.state.zones.delete(id);
    this.zoneCache = undefined;
    this.openZone(id);
  }

  private toZone(z: MapZone, custom = false) {
    const zone = new Zone();
    zone.name = z.name;
    zone.x = z.x;
    zone.y = z.y;
    zone.width = z.width;
    zone.height = z.height;
    zone.custom = custom;
    return zone;
  }

  private fromStored(z: {
    id: string;
    name: string;
    col: number;
    row: number;
    cols: number;
    rows: number;
  }): MapZone {
    return {
      id: z.id,
      name: z.name,
      x: z.col * TILE_SIZE,
      y: z.row * TILE_SIZE,
      width: z.cols * TILE_SIZE,
      height: z.rows * TILE_SIZE,
    };
  }

  // "Private room 1", "Private room 2", ... the lowest number not in use.
  private nextZoneName() {
    const used = new Set([...this.state.zones.values()].map((z) => z.name));
    let n = 1;
    while (used.has(`Private room ${n}`)) n++;
    return `Private room ${n}`;
  }

  // Moves a player into a room (or out of all of them); a locked room that just emptied opens.
  private setZone(player: Player, next: string) {
    const previous = player.zone;
    player.zone = next;
    // Walking into or out of a room ends a presentation: its audience is the room.
    if (previous !== next) player.presenting = false;
    if (previous && previous !== next) this.releaseIfEmpty(previous);
  }

  private mayEnter(client: Client, zoneId: string) {
    const account = (client as Client<{ auth: Account }>).auth;
    const locked = this.state.zones.get(zoneId)?.locked ?? false;
    return !account || this.access.mayEnter(zoneId, locked, client.sessionId, account.role);
  }

  // The person is put back like at a wall, and the first try asks the people inside.
  private refuseEntry(client: Client, player: Player, zoneId: string) {
    client.send(MESSAGES.SNAP, { x: player.x, y: player.y });
    if (!this.access.startKnock(zoneId, client.sessionId, Date.now())) return;
    const knock: KnockPayload = { zoneId, knockerId: client.sessionId, name: player.name };
    for (const other of this.clients) {
      if (this.state.players.get(other.sessionId)?.zone === zoneId) {
        other.send(MESSAGES.KNOCK, knock);
      }
    }
    client.send(MESSAGES.KNOCK_RESULT, {
      zoneId,
      knockerId: client.sessionId,
      result: "knocking",
    } satisfies KnockResultPayload);
    this.clock.setTimeout(() => {
      if (this.access.knockingOn(client.sessionId) === zoneId) {
        this.closeKnock(client.sessionId, zoneId, "timeout");
      }
    }, KNOCK_TIMEOUT_MS);
  }

  // Ends a knock and tells the knocker and the people inside; "allowed" lets them in.
  private closeKnock(knockerId: string, zoneId: string, result: KnockOutcome) {
    this.access.endKnock(knockerId);
    if (result === "allowed") this.access.admit(zoneId, knockerId);
    const message: KnockResultPayload = { zoneId, knockerId, result };
    for (const client of this.clients) {
      if (
        client.sessionId === knockerId ||
        this.state.players.get(client.sessionId)?.zone === zoneId
      ) {
        client.send(MESSAGES.KNOCK_RESULT, message);
      }
    }
  }

  // A room is no longer locked (unlocked, empty or gone): nobody has to wait or stays let in.
  private openZone(zoneId: string) {
    const zone = this.state.zones.get(zoneId);
    if (zone) zone.locked = false;
    for (const knocker of this.access.knockersOf(zoneId)) {
      this.closeKnock(knocker, zoneId, "allowed");
    }
    this.access.reset(zoneId);
  }

  private releaseIfEmpty(zoneId: string) {
    if (!this.state.zones.get(zoneId)?.locked) return;
    for (const p of this.state.players.values()) if (p.zone === zoneId) return;
    this.openZone(zoneId);
  }

  // A room appeared or went away, so who stands in which room may have changed.
  private relocateAll() {
    const zones = this.zoneList();
    for (const player of this.state.players.values()) this.setZone(player, zoneAt(zones, player));
  }

  // Moves a player (onto a seat, or off it) and tells their own client, which would otherwise
  // keep its old position.
  private place(client: Client | undefined, player: Player, spot: Position, seat?: Seat) {
    player.x = spot.x;
    player.y = spot.y;
    this.setZone(player, zoneAt(this.zoneList(), spot));
    player.seat = seat?.id ?? "";
    player.facing = seat?.facing ?? "";
    client?.send(MESSAGES.SNAP, { x: spot.x, y: spot.y });
  }

  private standUp(sessionId: string, client?: Client) {
    const sitting = this.seated.get(sessionId);
    const player = this.state.players.get(sessionId);
    if (!sitting || !player) return;
    this.seated.delete(sessionId);
    const target = client ?? this.clients.getById(sessionId);
    this.place(target, player, pickStandSpot(this.grid, sitting.seat, sitting.before));
  }

  private placementError(
    item: NonNullable<ReturnType<typeof findFurniture>>,
    col: number,
    row: number,
  ) {
    return placementError(this.grid, item, col, row, {
      people: [...this.state.players.values()],
      personRadius: PLAYER_RADIUS,
      tables: this.map.tables,
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
    let spawn = resolveSpawn(lastX, lastY, this.grid);
    // Where they last stood may now be a locked room they cannot enter.
    const room = zoneAt(this.zoneList(), spawn);
    if (room && !this.mayEnter(client, room)) spawn = resolveSpawn(null, null, this.grid);
    player.x = spawn.x;
    player.y = spawn.y;
    player.zone = zoneAt(this.zoneList(), spawn);
    this.state.players.set(client.sessionId, player);
    this.budgets.set(client.sessionId, new MoveBudget(Date.now()));
  }

  async onLeave(client: Client<{ auth: Account }>) {
    const player = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    const knocking = this.access.knockingOn(client.sessionId);
    if (knocking) this.closeKnock(client.sessionId, knocking, "timeout");
    this.access.forget(client.sessionId);
    if (player?.zone) this.releaseIfEmpty(player.zone);
    this.lastRefresh.delete(client.sessionId);
    this.budgets.delete(client.sessionId);
    // Save where they would stand, not the chair (which is inside a wall as far as spawning goes).
    const sat = this.seated.get(client.sessionId);
    if (sat && player) {
      Object.assign(player, pickStandSpot(this.grid, sat.seat, sat.before));
      this.seated.delete(client.sessionId);
    }
    this.lastWave.delete(client.sessionId);
    if (!player || !client.auth) return;
    try {
      await this.options.spaces.savePosition(this.spaceId, client.auth.userId, player.x, player.y);
    } catch (err) {
      console.error("could not save position", err instanceof Error ? err.message : err);
    }
  }
}
