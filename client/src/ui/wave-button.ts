// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface WaveButton {
  /** Offers a wave at this person; undefined hides it. */
  show(name: string | undefined): void;
  destroy(): void;
}

const STYLE_ID = "void-wave-style";
const STYLES = `
.void-wave { position: fixed; left: 50%; bottom: 164px; z-index: 950; display: none; transform: translateX(-50%);
  padding: 6px; border-radius: var(--v-radius); }
.void-wave[data-visible="true"] { display: block; }
.void-wave button { padding: 8px 16px; border: 0; border-radius: var(--v-radius-in); font: 600 13px var(--v-font); cursor: pointer;
  background: var(--v-hover); color: var(--v-text); }
.void-wave button:hover:not(:disabled) { background: rgb(139 147 255 / 0.28); }
.void-wave button:disabled { opacity: 0.5; cursor: default; }
.void-wave button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
`;

/** A small button above the voice bar: wave at the nearest person in range. */
export function createWaveButton(onWave: () => void): WaveButton {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  const root = document.createElement("div");
  root.className = "void-wave v-glass";
  const button = document.createElement("button");
  button.type = "button";
  button.addEventListener("click", onWave);
  root.append(button);
  document.body.append(root);

  let shown: string | undefined;
  return {
    show(name) {
      if (name === shown) return;
      shown = name;
      root.dataset.visible = String(name !== undefined);
      if (name !== undefined) button.textContent = `👋 Wave at ${name}`;
    },
    destroy: () => root.remove(),
  };
}
