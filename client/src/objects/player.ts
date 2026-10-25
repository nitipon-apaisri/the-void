// lib
import Phaser from "phaser";

// shared
import { encodeLook, type Look } from "@void/shared";

// config
import { PLAYER_RADIUS } from "../config/env";

// systems
import { FACINGS, FRAME, facingFor, type Facing } from "../systems/character-frames";

// objects
import { animationKey, ensureLookTexture } from "./look-textures";

// How long after the last step a character counts as standing still.
const IDLE_AFTER_MS = 150;
// The accent used for "on" states in the interface (--v-on).
const SPEAKING_COLOR = 0x5eead4;
// The character stands in the lower part of its frame; this lifts the name above the head.
const NAME_OFFSET = -(FRAME.height * 0.7) + PLAYER_RADIUS;

/** A player: an animated character with the name above. (x, y) is where the feet are. */
export class PlayerSprite extends Phaser.GameObjects.Container {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly label: Phaser.GameObjects.Text;
  private readonly ring: Phaser.GameObjects.Ellipse;
  private readonly badge: Phaser.GameObjects.Text;
  private pulse?: Phaser.Tweens.Tween;
  private lookCode = "";
  private textureKey = "";
  private loadId = 0;
  private facing: Facing = "down";
  private moving = false;
  private seated = false;
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
    // A ring on the floor around the feet while this player talks; under the character.
    this.ring = scene.add
      .ellipse(0, PLAYER_RADIUS - 2, 44, 18)
      .setStrokeStyle(3, SPEAKING_COLOR)
      .setVisible(false);
    this.badge = scene.add
      .text(0, NAME_OFFSET - 16, "Presenting", {
        color: "#ffffff",
        backgroundColor: "#5b63d3",
        fontSize: "10px",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.setProfile(name, look);
    this.add([this.ring, this.sprite, this.label, this.badge]);
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

  /** A hand floats up over the head and fades. */
  wave() {
    const hand = this.scene.add
      .text(0, NAME_OFFSET - 22, "👋", { fontSize: "22px" })
      .setOrigin(0.5, 1);
    this.add(hand);
    this.scene.tweens.add({
      targets: hand,
      y: hand.y - 26,
      alpha: 0,
      duration: 1600,
      ease: "Sine.easeOut",
      onComplete: () => hand.destroy(),
    });
  }

  /** A pulsing ring at the feet while this player is talking. Cheap to call repeatedly. */
  setSpeaking(on: boolean) {
    if (this.ring.visible === on) return;
    this.ring.setVisible(on);
    this.pulse?.remove();
    this.pulse = undefined;
    this.ring.setScale(1);
    if (!on) return;
    this.pulse = this.scene.tweens.add({
      targets: this.ring,
      scale: 1.22,
      duration: 480,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  /** A small "Presenting" tag over the name while this player shares their screen. */
  setPresenting(on: boolean) {
    this.badge.setVisible(on);
  }

  get displayName() {
    return this.label.text;
  }

  setNameVisible(visible: boolean) {
    this.label.setVisible(visible);
  }

  /** Sits down facing the given way, or stands up (undefined or an unknown facing). */
  setSeated(facing: string | undefined) {
    const known = FACINGS.find((f) => f === facing);
    this.seated = known !== undefined;
    if (known) this.facing = known;
    // A back view has no sitting pose: sit it a little lower so it reads as sitting.
    this.sprite.y = PLAYER_RADIUS + (known === "up" ? 6 : 0);
    this.moving = false;
    this.play();
  }

  /** Call whenever this player takes a step; (dx, dy) says which way. */
  step(dx: number, dy: number) {
    if (this.seated) return;
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
      animationKey(
        this.textureKey,
        this.seated ? "sit" : this.moving ? "walk" : "idle",
        this.facing,
      ),
      true,
    );
  }
}
