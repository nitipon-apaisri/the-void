// lib
import Phaser from "phaser";

// shared
import { encodeLook, type Look } from "@void/shared";

// config
import { PLAYER_RADIUS } from "../config/env";

// systems
import { FRAME, facingFor, type Facing } from "../systems/character-frames";

// objects
import { animationKey, ensureLookTexture } from "./look-textures";

// How long after the last step a character counts as standing still.
const IDLE_AFTER_MS = 150;
// The character stands in the lower part of its frame; this lifts the name above the head.
const NAME_OFFSET = -(FRAME.height * 0.7) + PLAYER_RADIUS;

/** A player: an animated character with the name above. (x, y) is where the feet are. */
export class PlayerSprite extends Phaser.GameObjects.Container {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private lookCode = "";
  private textureKey = "";
  private loadId = 0;
  private facing: Facing = "down";
  private moving = false;
  private lastStep = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, name: string, look: Look) {
    super(scene, x, y);
    // The origin is the bottom so the feet line up with the collision circle's lower edge.
    // Hidden until the layers for this look have been drawn.
    this.sprite = scene.add
      .sprite(0, PLAYER_RADIUS, "__DEFAULT")
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.label = scene.add
      .text(0, NAME_OFFSET, "", { color: "#e5e7eb", fontSize: "12px" })
      .setOrigin(0.5, 1);
    this.setProfile(name, look);
    this.add([this.sprite, this.label]);
    this.setDepth(10);
    scene.add.existing(this);
  }

  /** Cheap to call on every state change: only touches what differs. */
  setProfile(name: string, look: Look) {
    if (this.label.text !== name) this.label.setText(name);
    const code = encodeLook(look);
    if (code === this.lookCode) return;
    this.lookCode = code;
    // A later change can overtake an earlier one that is still loading; only the newest wins.
    const id = ++this.loadId;
    ensureLookTexture(this.scene, look).then(
      (key) => {
        if (id !== this.loadId || !this.active) return;
        this.textureKey = key;
        this.sprite.setTexture(key).setVisible(true);
        this.play();
      },
      (err) => console.warn("character art failed to load", err),
    );
  }

  setNameVisible(visible: boolean) {
    this.label.setVisible(visible);
  }

  /** Call whenever this player takes a step; (dx, dy) says which way. */
  step(dx: number, dy: number) {
    this.lastStep = this.scene.time.now;
    const facing = facingFor(dx, dy, this.facing);
    if (this.moving && facing === this.facing) return;
    this.facing = facing;
    this.moving = true;
    this.play();
  }

  /** Call every frame: switches to idle once the steps stop. */
  tick(now: number) {
    if (this.moving && now - this.lastStep > IDLE_AFTER_MS) {
      this.moving = false;
      this.play();
    }
  }

  private play() {
    if (!this.textureKey) return;
    this.sprite.play(
      animationKey(this.textureKey, this.moving ? "walk" : "idle", this.facing),
      true,
    );
  }
}
