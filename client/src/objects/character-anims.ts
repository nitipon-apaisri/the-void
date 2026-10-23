// lib
import type Phaser from "phaser";

// systems
import { FACINGS, frameRange, type CharacterState, type Facing } from "../systems/character-frames";

export const characterTexture = (avatar: number) => `character-${avatar}`;
export const animationKey = (avatar: number, state: CharacterState, facing: Facing) =>
  `${characterTexture(avatar)}:${state}:${facing}`;

const FRAME_RATE: Record<CharacterState, number> = { idle: 6, walk: 10 };

/** One looping animation per character, state and direction. Call once the sheets are loaded. */
export function createCharacterAnimations(scene: Phaser.Scene, count: number) {
  for (let avatar = 0; avatar < count; avatar++) {
    for (const state of ["idle", "walk"] as const) {
      for (const facing of FACINGS) {
        scene.anims.create({
          key: animationKey(avatar, state, facing),
          frames: scene.anims.generateFrameNumbers(
            characterTexture(avatar),
            frameRange(state, facing),
          ),
          frameRate: FRAME_RATE[state],
          repeat: -1,
        });
      }
    }
  }
}
