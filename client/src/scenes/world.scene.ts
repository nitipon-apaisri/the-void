// lib
import Phaser from "phaser";

// config
import {
  MOVE_SEND_INTERVAL_MS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  REMOTE_TWEEN_MS,
  SERVER_URL,
} from "../config/env";

// net
import { connectToVoid, type VoidConnection } from "../net/void-connection";

// systems
import { stepPosition } from "../systems/movement";

export class WorldScene extends Phaser.Scene {
  private connection?: VoidConnection;
  private me!: Phaser.GameObjects.Arc;
  private others = new Map<string, Phaser.GameObjects.Arc>();
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private lastSent = 0;

  constructor() {
    super("world");
  }

  async create() {
    this.keys = this.input.keyboard!.createCursorKeys();
    this.me = this.add.circle(400, 300, PLAYER_RADIUS, 0x6ee7b7);

    const connection = await connectToVoid(SERVER_URL, { name: "guest" });
    this.connection = connection;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => void connection.leave());

    connection.onPlayerAdd((p) => {
      if (p.id === connection.sessionId) return;
      this.others.set(p.id, this.add.circle(p.x, p.y, PLAYER_RADIUS, 0x93c5fd));
    });
    connection.onPlayerMove((p) => {
      const dot = this.others.get(p.id);
      if (dot) this.tweens.add({ targets: dot, x: p.x, y: p.y, duration: REMOTE_TWEEN_MS });
    });
    connection.onPlayerRemove((id) => {
      this.others.get(id)?.destroy();
      this.others.delete(id);
    });
  }

  update(time: number, delta: number) {
    if (!this.connection) return;
    const dir = {
      dx: (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0),
      dy: (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0),
    };
    if (!dir.dx && !dir.dy) return;

    const next = stepPosition(this.me, dir, PLAYER_SPEED, delta);
    this.me.setPosition(next.x, next.y);
    if (time - this.lastSent > MOVE_SEND_INTERVAL_MS) {
      this.lastSent = time;
      this.connection.sendMove(next);
    }
  }
}
