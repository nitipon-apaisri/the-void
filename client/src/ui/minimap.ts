// shared
import type { CollisionGrid, Position } from "@void/shared";

// systems
import { fromMinimap, minimapScale, toMinimap, type MinimapScale } from "../systems/minimap";

// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface MinimapFrame {
  me: Position;
  others: readonly Position[];
  /** What the camera shows now, in world pixels. */
  view: { x: number; y: number; width: number; height: number };
}

export interface Minimap {
  /** Redraws the walls after furniture changed them. */
  refresh(): void;
  draw(frame: MinimapFrame): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

const WIDTH = 210;
const STYLE_ID = "void-minimap-style";
const STYLES = `
.void-minimap { position: fixed; left: 14px; bottom: 18px; z-index: 880; padding: 6px; border-radius: var(--v-radius); }
.void-minimap[hidden] { display: none; }
.void-minimap canvas { display: block; border-radius: 10px; cursor: pointer; }
`;

// Blueprint colours: walls and furniture show as blocks, open floor as the panel itself.
const SOLID = "rgb(139 147 255 / 0.38)";
const ME = "#ffffff";
const OTHER = "#5eead4";
const VIEW = "rgb(255 255 255 / 0.7)";

/** A small map of the whole space. Clicking it sends you there; `onGo` gets the world position. */
export function createMinimap(grid: CollisionGrid, onGo: (target: Position) => void): Minimap {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  const world = { width: grid.cols * grid.tileSize, height: grid.rows * grid.tileSize };
  const scale: MinimapScale = minimapScale(world, WIDTH);

  // The walls only change when furniture is placed, so they are drawn then and copied each frame.
  const backdrop = document.createElement("canvas");
  backdrop.width = scale.width;
  backdrop.height = scale.height;
  const back = backdrop.getContext("2d")!;
  const tile = grid.tileSize * scale.factor;
  const paintWalls = () => {
    back.clearRect(0, 0, scale.width, scale.height);
    back.fillStyle = SOLID;
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (grid.blocked[row * grid.cols + col]) {
          back.fillRect(col * tile, row * tile, Math.ceil(tile), Math.ceil(tile));
        }
      }
    }
  };
  paintWalls();

  const root = document.createElement("div");
  root.className = "void-minimap v-glass";
  const canvas = document.createElement("canvas");
  canvas.width = scale.width;
  canvas.height = scale.height;
  canvas.setAttribute("aria-label", "Mini map. Click to walk there.");
  canvas.setAttribute("role", "img");
  root.append(canvas);
  document.body.append(root);
  const ctx = canvas.getContext("2d")!;

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    onGo(
      fromMinimap(
        {
          x: ((e.clientX - rect.left) / rect.width) * scale.width,
          y: ((e.clientY - rect.top) / rect.height) * scale.height,
        },
        scale,
        world,
      ),
    );
  });

  const dot = (pos: Position, color: string, radius: number) => {
    const p = toMinimap(pos, scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  return {
    refresh: paintWalls,
    draw({ me, others, view }) {
      if (root.hidden) return;
      ctx.clearRect(0, 0, scale.width, scale.height);
      ctx.drawImage(backdrop, 0, 0);
      const from = toMinimap(view, scale);
      ctx.strokeStyle = VIEW;
      ctx.lineWidth = 1;
      ctx.strokeRect(from.x, from.y, view.width * scale.factor, view.height * scale.factor);
      for (const other of others) dot(other, OTHER, 2);
      dot(me, ME, 3);
    },
    setVisible: (visible) => (root.hidden = !visible),
    destroy: () => root.remove(),
  };
}
