import Phaser from "phaser";
import { Client, Room, getStateCallbacks } from "@colyseus/sdk";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";
const SPEED = 180;

class WorldScene extends Phaser.Scene {
  private room!: Room;
  private me!: Phaser.GameObjects.Arc;
  private others = new Map<string, Phaser.GameObjects.Arc>();
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private lastSent = 0;

  async create() {
    this.keys = this.input.keyboard!.createCursorKeys();
    this.me = this.add.circle(400, 300, 12, 0x6ee7b7);

    const client = new Client(SERVER_URL);
    this.room = await client.joinOrCreate("void", { name: "guest" });

    const $ = getStateCallbacks(this.room);
    $(this.room.state).players.onAdd((p: any, id: string) => {
      if (id === this.room.sessionId) return;
      const dot = this.add.circle(p.x, p.y, 12, 0x93c5fd);
      this.others.set(id, dot);
      $(p).onChange(() => this.tweens.add({ targets: dot, x: p.x, y: p.y, duration: 100 }));
    });
    $(this.room.state).players.onRemove((_: any, id: string) => {
      this.others.get(id)?.destroy();
      this.others.delete(id);
    });
  }

  update(time: number, delta: number) {
    if (!this.room) return;
    const dx = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    const dy = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
    if (!dx && !dy) return;
    const len = Math.hypot(dx, dy);
    this.me.x += (dx / len) * SPEED * (delta / 1000);
    this.me.y += (dy / len) * SPEED * (delta / 1000);
    if (time - this.lastSent > 80) {
      this.lastSent = time;
      this.room.send("move", { x: this.me.x, y: this.me.y });
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#0b0b10",
  scene: WorldScene,
  scale: { mode: Phaser.Scale.RESIZE },
});
