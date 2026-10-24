// shared
import type { FurnitureItem } from "@void/shared";

// ui
import { createArtPicker } from "./art-picker";
import { ICONS } from "./icons";
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export type DecorateTool =
  | { kind: "item"; item: FurnitureItem }
  | { kind: "remove" }
  // Private rooms: two clicks draw one, a click on a drawn one removes it.
  | { kind: "zone" }
  | { kind: "unzone" };

export interface DecoratePanel {
  /** Shows or hides the launcher (hiding closes the panel); `canEmpty` shows the empty-space button. */
  setAvailable(available: boolean, canEmpty?: boolean): void;
  close(): void;
  destroy(): void;
}

export interface DecorateActions {
  /** The panel opened or closed. */
  onToggle(open: boolean): void;
  /** The chosen tool changed; undefined means nothing is selected. */
  onTool(tool: DecorateTool | undefined): void;
  /** The person confirmed emptying the whole space. */
  onReset(): void;
}

const STYLE_ID = "void-decorate-style";
const STYLES = `
.void-decor-btn { position: fixed; right: 14px; bottom: 272px; z-index: 900; display: none; place-items: center; width: 48px; height: 48px;
  padding: 0; border-radius: 50%; color: var(--v-muted); cursor: pointer; }
.void-decor-btn[data-available="true"] { display: grid; }
.void-decor-btn:hover { color: var(--v-text); }
.void-decor-btn[aria-pressed="true"] { background: rgb(139 147 255 / 0.28); color: var(--v-text); }
.void-decor-btn:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
.void-decor { position: fixed; right: 72px; bottom: 150px; z-index: 900; width: 360px; max-width: calc(100vw - 96px); max-height: calc(100vh - 190px); overflow-y: auto;
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
.void-decor-preview { position: relative; width: 56px; height: 56px; overflow: hidden; }
.void-decor-preview > div { position: absolute; left: 50%; top: 50%; image-rendering: pixelated; background-repeat: no-repeat; }
.void-decor-remove { grid-column: 1 / -1; }
.void-decor-grid button[hidden] { display: none; }
.void-art-cards, .void-art-groups { grid-template-columns: repeat(3, 1fr); }
.void-art-cards { max-height: 300px; overflow-y: auto; }
.void-art-cards[hidden], .void-art-groups[hidden], .void-art div[hidden] { display: none; }
.void-decor-footer { margin-top: 10px; }
.void-art-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.void-art-head[hidden] { display: none; }
.void-art-head button { padding: 3px 10px; border: 1px solid var(--v-line); border-radius: 8px; background: var(--v-field); color: inherit; font: inherit; font-size: 12px; cursor: pointer; }
.void-art-head strong { font-weight: 600; }
.void-art-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.void-art-tabs button { padding: 4px 10px; border: 1px solid var(--v-line); border-radius: 8px; background: var(--v-field); color: inherit; font: inherit; font-size: 12px; cursor: pointer; }
.void-art-tabs button[aria-pressed="true"] { border-color: var(--v-accent); background: rgb(139 147 255 / 0.2); }
.void-art-scroll { max-height: 300px; overflow: auto; border-radius: 8px; background: #2a2c40; }
.void-art-sheet { position: relative; image-rendering: pixelated; background-repeat: no-repeat; cursor: crosshair; touch-action: none;
  background-size: 100% 100%; }
.void-art-mark { position: absolute; border: 2px solid #ffd166; box-sizing: border-box; pointer-events: none; }
.void-art-mark[hidden] { display: none; }
.void-art label { display: block; margin-top: 8px; }
.void-art p { margin: 6px 0 0; }
`;

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
  panel.innerHTML =
    "<h2>Decorate</h2><p>Pick a group, then a piece, then click the map. Esc to finish.</p>";
  const removeButton = document.createElement("button");
  const toolButtons: HTMLButtonElement[] = [removeButton];
  // Groups of pieces, then the pieces of one group; picking one hands the scene a tool.
  const picker = createArtPicker((item) => {
    for (const b of toolButtons) b.setAttribute("aria-pressed", "false");
    actions.onTool(item && { kind: "item", item });
  });
  panel.append(picker.element);
  const grid = document.createElement("div");
  grid.className = "void-decor-grid void-decor-footer";
  panel.append(grid);
  // A button that switches one non-catalogue tool on or off; only one tool is on at a time.
  const addTool = (button: HTMLButtonElement, label: string, tool: DecorateTool) => {
    button.type = "button";
    button.className = "void-decor-remove";
    button.textContent = label;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const on = button.getAttribute("aria-pressed") !== "true";
      picker.clear();
      for (const b of toolButtons) b.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-pressed", String(on));
      actions.onTool(on ? tool : undefined);
    });
    grid.append(button);
  };
  addTool(removeButton, "Remove pieces", { kind: "remove" });
  // Owners and admins only.
  const zoneButton = document.createElement("button");
  const unzoneButton = document.createElement("button");
  toolButtons.push(zoneButton, unzoneButton);
  addTool(zoneButton, "Draw a private room", { kind: "zone" });
  addTool(unzoneButton, "Remove a private room", { kind: "unzone" });

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
    if (!open) {
      picker.clear();
      for (const b of toolButtons) b.setAttribute("aria-pressed", "false");
      actions.onTool(undefined);
    }
    actions.onToggle(open);
  };
  launcher.addEventListener("click", () => setOpen(Boolean(panel.hidden)));
  document.body.append(launcher, panel);

  return {
    setAvailable(available, canEmpty = false) {
      reset.hidden = zoneButton.hidden = unzoneButton.hidden = !canEmpty;
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
