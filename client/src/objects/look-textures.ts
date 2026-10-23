// lib
import type Phaser from "phaser";

// shared
import { encodeLook, type Look } from "@void/shared";

// systems
import {
  FACINGS,
  FRAME,
  frameRange,
  type CharacterState,
  type Facing,
} from "../systems/character-frames";

// utils
import { drawLayers, loadLookImages } from "../utils/look-render";

// Only the idle and walk rows (1 and 2), 24 frames wide, are used; row 0 stays empty so the
// frame numbers match the layout in character-frames.ts.
const USED_COLUMNS = 24;
const USED_ROWS = 3;
const FRAME_RATE: Record<CharacterState, number> = { idle: 6, walk: 10 };

export const animationKey = (textureKey: string, state: CharacterState, facing: Facing) =>
  `${textureKey}:${state}:${facing}`;

const pending = new Map<string, Promise<string>>();

/**
 * The texture key for a look, building the texture and its animations the first time that
 * look is seen. Resolves once the layers have loaded; layers are cached, so a new player who
 * shares parts with someone already in the world is almost instant.
 */
export function ensureLookTexture(scene: Phaser.Scene, look: Look): Promise<string> {
  const key = `look-${encodeLook(look)}`;
  if (scene.textures.exists(key)) return Promise.resolve(key);
  let built = pending.get(key);
  if (!built) {
    built = build(scene, key, look).finally(() => pending.delete(key));
    pending.set(key, built);
  }
  return built;
}

async function build(scene: Phaser.Scene, key: string, look: Look): Promise<string> {
  const layers = await loadLookImages(look);
  // The scene may have gone away (or another call built it) while the images loaded.
  if (!scene.sys.isActive() || scene.textures.exists(key)) return key;

  const width = USED_COLUMNS * FRAME.width;
  const height = USED_ROWS * FRAME.height;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`could not create ${key}`);
  drawLayers(texture.getContext(), layers, { x: 0, y: 0, width, height });
  for (let row = 1; row < USED_ROWS; row++) {
    for (let col = 0; col < USED_COLUMNS; col++) {
      texture.add(
        row * FRAME.columns + col,
        0,
        col * FRAME.width,
        row * FRAME.height,
        FRAME.width,
        FRAME.height,
      );
    }
  }
  texture.refresh();

  for (const state of ["idle", "walk"] as const) {
    for (const facing of FACINGS) {
      scene.anims.create({
        key: animationKey(key, state, facing),
        frames: scene.anims.generateFrameNumbers(key, frameRange(state, facing)),
        frameRate: FRAME_RATE[state],
        repeat: -1,
      });
    }
  }
  return key;
}
