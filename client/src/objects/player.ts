// lib
import Phaser from "phaser";

// shared
import { AVATAR_COLORS } from "@void/shared";

// config
import { PLAYER_RADIUS } from "../config/env";

/** A player's avatar: a coloured dot with its name above. */
export class PlayerSprite extends Phaser.GameObjects.Container {
  private readonly dot: Phaser.GameObjects.Arc;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, name: string, avatar: number) {
    super(scene, x, y);
    this.dot = scene.add.circle(0, 0, PLAYER_RADIUS);
    this.label = scene.add
      .text(0, -PLAYER_RADIUS - 6, "", { color: "#e5e7eb", fontSize: "12px" })
      .setOrigin(0.5, 1);
    this.setProfile(name, avatar);
    this.add([this.dot, this.label]);
    this.setDepth(10);
    scene.add.existing(this);
  }

  /** Cheap to call on every state change: only touches what differs. */
  setProfile(name: string, avatar: number) {
    if (this.label.text !== name) this.label.setText(name);
    this.dot.setFillStyle(AVATAR_COLORS[avatar] ?? AVATAR_COLORS[0]);
  }
}
