// lib
import Phaser from "phaser";

// shared
import { AVATAR_COLORS } from "@void/shared";

// config
import { PLAYER_RADIUS } from "../config/env";

/** A player's avatar: a coloured dot with its name above. */
export class PlayerSprite extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, name: string, avatar: number) {
    super(scene, x, y);
    const color = AVATAR_COLORS[avatar] ?? AVATAR_COLORS[0];
    const dot = scene.add.circle(0, 0, PLAYER_RADIUS, color);
    const label = scene.add
      .text(0, -PLAYER_RADIUS - 6, name, { color: "#e5e7eb", fontSize: "12px" })
      .setOrigin(0.5, 1);
    this.add([dot, label]);
    this.setDepth(10);
    scene.add.existing(this);
  }
}
