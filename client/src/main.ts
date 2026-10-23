import Phaser from "phaser";

import { WorldScene } from "./scenes/world.scene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#0b0b10",
  // The art is 32px pixel art: scale it with nearest-neighbour and whole pixels, never blurred.
  pixelArt: true,
  scene: [WorldScene],
  scale: { mode: Phaser.Scale.RESIZE },
});
