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
  /** Tell the room our name or look changed so everyone sees the new one. */
  refreshProfile(): void;
  onPlayerAdd(cb: (player: PlayerSnapshot) => void): void;
  onPlayerMove(cb: (player: PlayerSnapshot) => void): void;
  onPlayerRemove(cb: (id: string) => void): void;
  /** The server refused a move and says where we are. */
  onSnap(cb: (pos: Position) => void): void;
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
    refreshProfile: () => room.send(MESSAGES.REFRESH_PROFILE),
    onPlayerAdd: (cb) => players.onAdd((p: any, id: string) => cb(snapshot(p, id))),
    onPlayerMove: (cb) =>
      players.onAdd((p: any, id: string) => $(p).onChange(() => cb(snapshot(p, id)))),
    onPlayerRemove: (cb) => players.onRemove((_: any, id: string) => cb(id)),
    onSnap: (cb) => room.onMessage(MESSAGES.SNAP, cb),
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
