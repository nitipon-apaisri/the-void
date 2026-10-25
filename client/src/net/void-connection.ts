// lib
import { Client, getStateCallbacks } from "@colyseus/sdk";

// shared
import {
  DEFAULT_LOOK,
  decodeLook,
  MESSAGES,
  ROOM_NAME,
  type ClaimTablePayload,
  type JoinOptions,
  type PlacedFurniture,
  type SitPayload,
  type PlaceFurniturePayload,
  type RemoveFurniturePayload,
  type AddZonePayload,
  type MapZone,
  type AnswerKnockPayload,
  type KnockPayload,
  type KnockResultPayload,
  type LockZonePayload,
  type ModerateAction,
  type ModeratedPayload,
  type ModeratePayload,
  type PresentPayload,
  type RemoveZonePayload,
  type WavedPayload,
  type Look,
  type Position,
  type VoiceToken,
} from "@void/shared";

export interface TableClaimSnapshot {
  tableId: string;
  userId: string;
  name: string;
}

export interface PlayerSnapshot extends Position {
  id: string;
  /** The account behind the session, to match the member list. */
  userId: string;
  name: string;
  look: Look;
  /** The seat they are on ("" when standing) and the way they face there. */
  seat: string;
  facing: string;
  /** The meeting room they stand in ("" outside all of them); only the server sets it. */
  zone: string;
  /** Sharing their screen as a presentation. */
  presenting: boolean;
}

/** What scenes know about the network. Keeps Colyseus out of game code. */
export interface VoidConnection {
  sessionId: string;
  sendMove(pos: Position): void;
  /** Rejects when the server has no LiveKit configured. */
  requestVoiceToken(): Promise<VoiceToken>;
  /** Rejects with the server's reason (taken, too far, you already have one). */
  claimTable(tableId: string): Promise<void>;
  releaseTable(): Promise<void>;
  /** Fires with every current claim whenever one is added, changed or removed. */
  onClaims(cb: (claims: TableClaimSnapshot[]) => void): void;
  /** Owners and admins only. Rejects with the server's reason (in the way, too many pieces). */
  placeFurniture(piece: PlaceFurniturePayload): Promise<void>;
  removeFurniture(id: string): Promise<void>;
  /** Owners and admins only: removes every placed piece. */
  clearFurniture(): Promise<void>;
  /** Fires with every placed piece whenever one is added or removed. */
  onFurniture(cb: (pieces: PlacedFurniture[]) => void): void;
  /** Owners and admins only. Rejects with the server's reason (overlap, too small, too many). */
  addZone(rect: AddZonePayload): Promise<void>;
  removeZone(id: string): Promise<void>;
  /** Fires with every private room (the template's and the drawn ones) whenever one changes. */
  onZones(cb: (zones: MapZone[]) => void): void;
  /** Claim or give up the stage. Rejects with the reason (someone else presents in this room). */
  setPresenting(on: boolean): Promise<void>;
  /** Owners and admins: ask someone to mute their mic or end their presentation. */
  moderate(userId: string, action: ModerateAction): Promise<void>;
  /** An owner or admin muted us or ended our presentation. */
  onModerated(cb: (moderated: ModeratedPayload) => void): void;
  /** Lock or unlock the room you stand in. Rejects with the server's reason. */
  lockZone(id: string, locked: boolean): Promise<void>;
  /** Anyone inside a locked room may let a knocker in or turn them away. */
  answerKnock(knockerId: string, allow: boolean): Promise<void>;
  /** Someone is knocking on the room you are in. */
  onKnock(cb: (knock: KnockPayload) => void): void;
  /** A knock moved on: ours (knocking, let in, turned away) or one on our room that was answered. */
  onKnockResult(cb: (result: KnockResultPayload) => void): void;
  /** Sit on a seat within reach; the room snaps us onto it. Rejects with its reason. */
  sit(seatId: string): Promise<void>;
  stand(): Promise<void>;
  /** Wave at a player by session id; the room ignores it if they are too far or we waved just now. */
  wave(targetId: string): void;
  /** A wave happened that involves us, as the waver or the target. */
  onWaved(cb: (wave: WavedPayload) => void): void;
  /** Tell the room our name or look changed so everyone sees the new one. */
  refreshProfile(): void;
  onPlayerAdd(cb: (player: PlayerSnapshot) => void): void;
  onPlayerMove(cb: (player: PlayerSnapshot) => void): void;
  onPlayerRemove(cb: (id: string) => void): void;
  /** The server refused a move and says where we are. */
  onSnap(cb: (pos: Position) => void): void;
  /** The space was emptied and now uses another map. */
  onSpaceReset(cb: () => void): void;
  /** You were removed from the space; the connection closes right after. */
  onRemoved(cb: () => void): void;
  /** Someone joined, left or got a new role: read the member list again. */
  onMembersChanged(cb: () => void): void;
  /** Connection lost; the SDK is trying to reconnect on its own. */
  onDrop(cb: () => void): void;
  /** The SDK's automatic reconnect succeeded. */
  onReconnect(cb: () => void): void;
  /** Fires when the server connection is gone for good. Not called after our own leave(). */
  onDisconnect(cb: (code: number) => void): void;
  leave(): Promise<void>;
}

/** Thrown by connectToVoid when the server says we are not a member of the space. */
export class NotInSpaceError extends Error {}

/** Thrown by connectToVoid when the server rejected our token. */
export class NotSignedInError extends Error {}

export async function connectToVoid(url: string, options: JoinOptions): Promise<VoidConnection> {
  const room = await new Client(url).joinOrCreate(ROOM_NAME, options).catch((err) => {
    const code = (err as { code?: number }).code;
    if (code === 401) throw new NotSignedInError("not signed in");
    if (code === 403) throw new NotInSpaceError("not in this space");
    throw err;
  });
  const $ = getStateCallbacks(room);
  const players = $(room.state as any).players;
  let leaving = false;
  const snapshot = (p: any, id: string): PlayerSnapshot => ({
    id,
    userId: p.userId,
    name: p.name,
    // The room only ever stores a validated look, so the fallback is for a bad edit by hand.
    look: decodeLook(p.look) ?? DEFAULT_LOOK,
    x: p.x,
    y: p.y,
    seat: p.seat,
    facing: p.facing,
    zone: p.zone,
    presenting: p.presenting,
  });

  return {
    sessionId: room.sessionId,
    sendMove: (pos) => room.send(MESSAGES.MOVE, pos),
    requestVoiceToken: () => room.request(MESSAGES.VOICE_TOKEN),
    claimTable: async (tableId) => {
      await room.request(MESSAGES.CLAIM_TABLE, { tableId } satisfies ClaimTablePayload);
    },
    releaseTable: async () => {
      await room.request(MESSAGES.UNCLAIM_TABLE);
    },
    onClaims: (cb) => {
      const claims = new Map<string, TableClaimSnapshot>();
      const emit = () => cb([...claims.values()]);
      const tables = $(room.state as any).tables;
      tables.onAdd((c: any, tableId: string) => {
        const set = () => {
          claims.set(tableId, { tableId, userId: c.userId, name: c.name });
          emit();
        };
        set();
        $(c).onChange(set);
      });
      tables.onRemove((_: any, tableId: string) => {
        claims.delete(tableId);
        emit();
      });
    },
    placeFurniture: async (piece) => {
      await room.request(MESSAGES.PLACE_FURNITURE, piece);
    },
    removeFurniture: async (id) => {
      await room.request(MESSAGES.REMOVE_FURNITURE, { id } satisfies RemoveFurniturePayload);
    },
    clearFurniture: async () => {
      await room.request(MESSAGES.CLEAR_FURNITURE);
    },
    onFurniture: (cb) => {
      const pieces = new Map<string, PlacedFurniture>();
      const emit = () => cb([...pieces.values()]);
      const furniture = $(room.state as any).furniture;
      furniture.onAdd((f: any, id: string) => {
        pieces.set(id, { id, itemId: f.itemId, col: f.col, row: f.row });
        emit();
      });
      furniture.onRemove((_: any, id: string) => {
        pieces.delete(id);
        emit();
      });
    },
    addZone: async (rect) => {
      await room.request(MESSAGES.ADD_ZONE, rect);
    },
    removeZone: async (id) => {
      await room.request(MESSAGES.REMOVE_ZONE, { id } satisfies RemoveZonePayload);
    },
    onZones: (cb) => {
      const zones = new Map<string, MapZone>();
      const emit = () => cb([...zones.values()]);
      const state = $(room.state as any).zones;
      state.onAdd((z: any, id: string) => {
        zones.set(id, {
          id,
          name: z.name,
          x: z.x,
          y: z.y,
          width: z.width,
          height: z.height,
          custom: z.custom,
          locked: z.locked,
        });
        emit();
        // Locking happens in place, so a change has to be passed on too.
        $(z).listen("locked", (locked: boolean) => {
          zones.set(id, { ...zones.get(id)!, locked });
          emit();
        });
      });
      state.onRemove((_: any, id: string) => {
        zones.delete(id);
        emit();
      });
    },
    setPresenting: async (on) => {
      await room.request(MESSAGES.PRESENT, { on } satisfies PresentPayload);
    },
    moderate: async (userId, action) => {
      await room.request(MESSAGES.MODERATE, { userId, action } satisfies ModeratePayload);
    },
    onModerated: (cb) => room.onMessage(MESSAGES.MODERATED, cb),
    lockZone: async (id, locked) => {
      await room.request(MESSAGES.LOCK_ZONE, { id, locked } satisfies LockZonePayload);
    },
    answerKnock: async (knockerId, allow) => {
      await room.request(MESSAGES.ANSWER_KNOCK, { knockerId, allow } satisfies AnswerKnockPayload);
    },
    onKnock: (cb) => room.onMessage(MESSAGES.KNOCK, cb),
    onKnockResult: (cb) => room.onMessage(MESSAGES.KNOCK_RESULT, cb),
    sit: async (seatId) => {
      await room.request(MESSAGES.SIT, { seatId } satisfies SitPayload);
    },
    stand: async () => {
      await room.request(MESSAGES.STAND);
    },
    wave: (targetId) => room.send(MESSAGES.WAVE, { targetId }),
    onWaved: (cb) => room.onMessage(MESSAGES.WAVED, cb),
    refreshProfile: () => room.send(MESSAGES.REFRESH_PROFILE),
    onPlayerAdd: (cb) => players.onAdd((p: any, id: string) => cb(snapshot(p, id))),
    onPlayerMove: (cb) =>
      players.onAdd((p: any, id: string) => $(p).onChange(() => cb(snapshot(p, id)))),
    onPlayerRemove: (cb) => players.onRemove((_: any, id: string) => cb(id)),
    onSnap: (cb) => room.onMessage(MESSAGES.SNAP, cb),
    onSpaceReset: (cb) => room.onMessage(MESSAGES.SPACE_RESET, cb),
    onRemoved: (cb) => room.onMessage(MESSAGES.REMOVED, cb),
    onMembersChanged: (cb) => room.onMessage(MESSAGES.MEMBERS_CHANGED, cb),
    onDrop: (cb) =>
      room.onDrop(() => {
        if (!leaving) cb();
      }),
    onReconnect: (cb) => room.onReconnect(cb),
    onDisconnect: (cb) =>
      room.onLeave((code: number) => {
        if (!leaving) cb(code);
      }),
    leave: async () => {
      leaving = true;
      await room.leave();
    },
  };
}
