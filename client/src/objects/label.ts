// lib
import Phaser from "phaser";

// The chip behind names in the world; the same look as --v-chip in ui/theme.ts.
const CHIP_FILL = 0x0d0e17;
const CHIP_ALPHA = 0.72;
const PADDING = { x: 7, y: 3 };
const FONT = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

interface ChipOptions {
  color: string;
  fontSize: string;
  fill?: number;
  alpha?: number;
  // Where (x, y) sits on the chip: (0.5, 1) is bottom centre.
  origin?: { x: number; y: number };
}

/** A line of text on a pill. Phaser text backgrounds are square, so the pill is drawn behind it. */
export class Chip extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly fill: number;
  private readonly alpha_: number;
  private readonly anchor: { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number, content: string, options: ChipOptions) {
    super(scene, x, y);
    this.fill = options.fill ?? CHIP_FILL;
    this.alpha_ = options.alpha ?? CHIP_ALPHA;
    this.anchor = options.origin ?? { x: 0.5, y: 0.5 };
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, content, {
        fontFamily: FONT,
        color: options.color,
        fontSize: options.fontSize,
        padding: PADDING,
      })
      .setOrigin(this.anchor.x, this.anchor.y);
    this.add([this.bg, this.label]);
    this.redraw();
  }

  /** The text on the chip. */
  get text() {
    return this.label.text;
  }

  setText(content: string) {
    if (content === this.label.text) return this;
    this.label.setText(content);
    this.redraw();
    return this;
  }

  private redraw() {
    const { width, height } = this.label;
    this.setSize(width, height);
    this.bg
      .clear()
      .fillStyle(this.fill, this.alpha_)
      .fillRoundedRect(-width * this.anchor.x, -height * this.anchor.y, width, height, height / 2);
  }
}
