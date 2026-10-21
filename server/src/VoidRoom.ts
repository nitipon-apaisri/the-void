import { Room, Client } from "@colyseus/core";
import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
}

export class VoidState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

export class VoidRoom extends Room<{ state: VoidState }> {
  maxClients = 100;

  onCreate() {
    this.setState(new VoidState());
    this.onMessage("move", (client, pos: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) return;
      p.x = pos.x;
      p.y = pos.y;
    });
  }

  onJoin(client: Client, options: { name?: string }) {
    const p = new Player();
    p.name = String(options?.name ?? "guest").slice(0, 24);
    p.x = 400;
    p.y = 300;
    this.state.players.set(client.sessionId, p);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }
}
