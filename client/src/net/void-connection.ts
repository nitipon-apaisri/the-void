// lib
import { Client, getStateCallbacks } from "@colyseus/sdk";

// shared
import {
  MESSAGES,
  ROOM_NAME,
  type JoinOptions,
  type Position,
  type VoiceToken,
} from "@void/shared";

export interface PlayerSnapshot extends Position {
  id: string;
  name: string;
  avatar: number;
}

/** What scenes know about the network. Keeps Colyseus out of game code. */
export interface VoidConnection {
  sessionId: string;
  sendMove(pos: Position): void;
  /** Rejects when the server has no LiveKit configured. */
  requestVoiceToken(): Promise<VoiceToken>;
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

export async function connectToVoid(url: string, options: JoinOptions): Promise<VoidConnection> {
  const room = await new Client(url).joinOrCreate(ROOM_NAME, options);
  const $ = getStateCallbacks(room);
  const players = $(room.state as any).players;
  let leaving = false;
  const snapshot = (p: any, id: string): PlayerSnapshot => ({
    id,
    name: p.name,
    avatar: p.avatar,
    x: p.x,
    y: p.y,
  });

  return {
    sessionId: room.sessionId,
    sendMove: (pos) => room.send(MESSAGES.MOVE, pos),
    requestVoiceToken: () => room.request(MESSAGES.VOICE_TOKEN),
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
