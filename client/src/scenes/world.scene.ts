// lib
import Phaser from "phaser";

// config
import {
  CONNECT_RETRY_MS,
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

// ui
import { createToast, type Toast } from "../ui/toast";

export class WorldScene extends Phaser.Scene {
  private connection?: VoidConnection;
  private connecting = false;
  private wasOffline = false;
  private toast!: Toast;
  private me!: Phaser.GameObjects.Arc;
  private others = new Map<string, Phaser.GameObjects.Arc>();
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private lastSent = 0;
  private unsent = false;

  constructor() {
    super("world");
  }

  create() {
    this.keys = this.input.keyboard!.createCursorKeys();
    this.me = this.add.circle(400, 300, PLAYER_RADIUS, 0x6ee7b7);
    this.toast = createToast();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      void this.connection?.leave();
      this.toast.destroy();
    });
    void this.connect();
  }

  // Movement works offline; the connection only adds other players and sync.
  private async connect() {
    if (this.connecting) return;
    this.connecting = true;
    try {
      const connection = await connectToVoid(SERVER_URL, { name: "guest" });
      this.connection = connection;
      this.unsent = true;
      if (this.wasOffline) this.toast.show("Back online", "success", 2500);
      else this.toast.hide();
      this.wasOffline = false;

      connection.onPlayerAdd((p) => {
        if (p.id === connection.sessionId) return;
        this.others.set(p.id, this.add.circle(p.x, p.y, PLAYER_RADIUS, 0x93c5fd));
      });
      connection.onPlayerMove((p) => {
        const dot = this.others.get(p.id);
        if (dot) this.tweens.add({ targets: dot, x: p.x, y: p.y, duration: REMOTE_TWEEN_MS });
      });
      connection.onPlayerRemove((id) => this.removeOther(id));
      connection.onDrop(() => {
        this.toast.show("Connection lost. Reconnecting…", "error");
      });
      connection.onReconnect(() => {
        this.unsent = true;
        this.toast.show("Back online", "success", 2500);
      });
      connection.onDisconnect(() => {
        this.connection = undefined;
        [...this.others.keys()].forEach((id) => this.removeOther(id));
        this.wasOffline = true;
        this.toast.show("Lost connection to the server. Reconnecting…", "error");
        this.time.delayedCall(CONNECT_RETRY_MS, () => void this.connect());
      });
    } catch (err) {
      console.error("could not connect to", SERVER_URL, err);
      this.wasOffline = true;
      this.toast.show("Can't reach the server. Retrying…", "error");
      this.time.delayedCall(CONNECT_RETRY_MS, () => void this.connect());
    } finally {
      this.connecting = false;
    }
  }

  private removeOther(id: string) {
    this.others.get(id)?.destroy();
    this.others.delete(id);
  }

  update(time: number, delta: number) {
    const dir = {
      dx: (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0),
      dy: (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0),
    };
    if (dir.dx || dir.dy) {
      const next = stepPosition(this.me, dir, PLAYER_SPEED, delta);
      this.me.setPosition(next.x, next.y);
      this.unsent = true;
    }

    // Throttled, but also flushes the final position after the player stops.
    if (this.connection && this.unsent && time - this.lastSent > MOVE_SEND_INTERVAL_MS) {
      this.lastSent = time;
      this.unsent = false;
      this.connection.sendMove({ x: this.me.x, y: this.me.y });
    }
  }
}
