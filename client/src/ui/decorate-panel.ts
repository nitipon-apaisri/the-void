// shared
import { FURNITURE, TILE_SIZE, type FurnitureItem } from "@void/shared";

// ui
import { ICONS } from "./icons";
import { applyTheme } from "./theme";

// utils
import { tilesetUrls } from "../utils/game-art";
import { injectStyle } from "../utils/dom";

export type DecorateTool = { kind: "item"; item: FurnitureItem } | { kind: "remove" };

export interface DecoratePanel {
  /** Shows the launcher button, or hides it (and closes the panel) for people who cannot decorate. */
  setAvailable(available: boolean): void;
  close(): void;
  destroy(): void;
}

export interface DecorateActions {
  /** The panel opened or closed. */
  onToggle(open: boolean): void;
  /** The chosen tool changed; undefined means nothing is selected. */
  onTool(tool: DecorateTool | undefined): void;
  /** The person confirmed removing every placed piece. */
  onReset(): void;
}

const PREVIEW = 56;
const STYLE_ID = "void-decorate-style";
const STYLES = `
.void-decor-btn { position: fixed; right: 14px; bottom: 272px; z-index: 900; display: none; place-items: center; width: 48px; height: 48px;
  padding: 0; border-radius: 50%; color: var(--v-muted); cursor: pointer; }
.void-decor-btn[data-available="true"] { display: grid; }
.void-decor-btn:hover { color: var(--v-text); }
.void-decor-btn[aria-pressed="true"] { background: rgb(139 147 255 / 0.28); color: var(--v-text); }
.void-decor-btn:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
.void-decor { position: fixed; right: 72px; bottom: 150px; z-index: 900; width: 232px; max-height: calc(100vh - 190px); overflow-y: auto;
  padding: 12px; border-radius: var(--v-radius); font: 500 13px/1.4 var(--v-font); color: var(--v-text); }
.void-decor[hidden] { display: none; }
.void-decor h2 { margin: 0 0 4px; font: 600 14px var(--v-font); }
.void-decor p { margin: 0 0 10px; color: var(--v-muted); font-size: 12px; }
.void-decor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.void-decor-grid button { display: grid; gap: 4px; justify-items: center; padding: 6px 4px; border: 1px solid var(--v-line); border-radius: 10px;
  background: var(--v-field); color: inherit; font: inherit; font-size: 12px; cursor: pointer; }
.void-decor-grid button:hover { background: var(--v-hover); }
.void-decor-grid button[aria-pressed="true"] { border-color: var(--v-accent); background: rgb(139 147 255 / 0.2); }
.void-decor-grid button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 1px; }
.void-decor-preview { position: relative; width: ${PREVIEW}px; height: ${PREVIEW}px; overflow: hidden; }
.void-decor-preview > div { position: absolute; left: 50%; top: 50%; image-rendering: pixelated; background-repeat: no-repeat; }
.void-decor-remove { grid-column: 1 / -1; }
`;

const preview = (item: FurnitureItem) => {
  const box = document.createElement("div");
  box.className = "void-decor-preview";
  const inner = document.createElement("div");
  const width = item.w * TILE_SIZE;
  const height = item.h * TILE_SIZE;
  const scale = Math.min(1, PREVIEW / Math.max(width, height));
  const url = tilesetUrls[item.sheet];
  inner.style.cssText =
    `width:${width}px;height:${height}px;` +
    (url ? `background-image:url(${url});` : "") +
    `background-position:${-item.sx * TILE_SIZE}px ${-item.sy * TILE_SIZE}px;` +
    `transform:translate(-50%,-50%) scale(${scale});`;
  box.append(inner);
  return box;
};

/** A launcher button and a catalogue of furniture. Picking a piece hands the scene a tool. */
export function createDecoratePanel(actions: DecorateActions): DecoratePanel {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "void-decor-btn v-glass";
  launcher.innerHTML = ICONS.decorate;
  launcher.title = "Decorate";
  launcher.setAttribute("aria-label", "Decorate");
  launcher.setAttribute("aria-pressed", "false");

  const panel = document.createElement("div");
  panel.className = "void-decor v-glass";
  panel.hidden = true;
  panel.innerHTML = "<h2>Decorate</h2><p>Pick a piece, then click the map. Esc to finish.</p>";
  const grid = document.createElement("div");
  grid.className = "void-decor-grid";
  panel.append(grid);

  const buttons = new Map<HTMLButtonElement, DecorateTool>();
  const select = (button: HTMLButtonElement | undefined) => {
    for (const b of buttons.keys()) b.setAttribute("aria-pressed", String(b === button));
    actions.onTool(button && buttons.get(button));
  };
  const addButton = (
    label: string,
    tool: DecorateTool,
    extra?: HTMLElement,
    className?: string,
  ) => {
    const button = document.createElement("button");
    button.type = "button";
    if (className) button.className = className;
    button.setAttribute("aria-pressed", "false");
    if (extra) button.append(extra);
    button.append(label);
    button.addEventListener("click", () =>
      select(button.getAttribute("aria-pressed") === "true" ? undefined : button),
    );
    buttons.set(button, tool);
    grid.append(button);
  };
  for (const item of FURNITURE) addButton(item.name, { kind: "item", item }, preview(item));
  addButton("Remove pieces", { kind: "remove" }, undefined, "void-decor-remove");

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "void-decor-remove";
  reset.textContent = "Empty the whole space";
  reset.addEventListener("click", () => {
    if (
      window.confirm(
        "Empty this space? Every piece, including the desks, chairs and tables that came with the template, is removed and the room becomes a bare empty room. Desk claims are lost. This cannot be undone.",
      )
    ) {
      actions.onReset();
    }
  });
  grid.append(reset);

  const setOpen = (open: boolean) => {
    if (!panel.hidden === open) return;
    panel.hidden = !open;
    launcher.setAttribute("aria-pressed", String(open));
    if (!open) select(undefined);
    actions.onToggle(open);
  };
  launcher.addEventListener("click", () => setOpen(Boolean(panel.hidden)));
  document.body.append(launcher, panel);

  return {
    setAvailable(available) {
      launcher.dataset.available = String(available);
      if (!available) setOpen(false);
    },
    close: () => setOpen(false),
    destroy() {
      launcher.remove();
      panel.remove();
    },
  };
}
