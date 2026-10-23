// lib
import { Client, getStateCallbacks } from "@colyseus/sdk";

// shared
import {
  DEFAULT_LOOK,
  decodeLook,
  MESSAGES,
  ROOM_NAME,
  type JoinOptions,
  type Look,
  type Position,
  type VoiceToken,
} from "@void/shared";

export interface PlayerSnapshot extends Position {
  id: string;
  name: string;
  look: Look;
}

/** What scenes know about the network. Keeps Colyseus out of game code. */
export interface VoidConnection {
  sessionId: string;
  sendMove(pos: Position): void;
  /** Rejects when the server has no LiveKit configured. */
  requestVoiceToken(): Promise<VoiceToken>;
  /** Tell the room our name or look changed so everyone sees the new one. */
  refreshProfile(): void;
  onPlayerAdd(cb: (player: PlayerSnapshot) => void): void;
  onPlayerMove(cb: (player: PlayerSnapshot) => void): void;
  onPlayerRemove(cb: (id: string) => void): void;
  /** Connection lost; the SDK is trying to reconnect on its own. */
  onDrop(cb: () => void): void;
  /** The SDK's automatic reconnect succeeded. */
  onReconnect(cb: () => void): void;
  /** Fires when the server connection is gone for good. Not called after our own leave(). */
  onDisconnect(cb: (code: number) => void): void;
  leave(): Promise<void>;
}

/** Thrown by connectToVoid when the server rejected our token. */
export class NotSignedInError extends Error {}

export async function connectToVoid(url: string, options: JoinOptions): Promise<VoidConnection> {
  const room = await new Client(url).joinOrCreate(ROOM_NAME, options).catch((err) => {
    if ((err as { code?: number }).code === 401) throw new NotSignedInError("not signed in");
    throw err;
  });
  const $ = getStateCallbacks(room);
  const players = $(room.state as any).players;
  let leaving = false;
  const snapshot = (p: any, id: string): PlayerSnapshot => ({
    id,
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
    refreshProfile: () => room.send(MESSAGES.REFRESH_PROFILE),
    onPlayerAdd: (cb) => players.onAdd((p: any, id: string) => cb(snapshot(p, id))),
    onPlayerMove: (cb) =>
      players.onAdd((p: any, id: string) => $(p).onChange(() => cb(snapshot(p, id)))),
    onPlayerRemove: (cb) => players.onRemove((_: any, id: string) => cb(id)),
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
