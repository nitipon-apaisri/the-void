// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface VisitBar {
  destroy(): void;
}

const STYLE_ID = "void-visit-style";
const STYLES = `
.void-visit { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 880; display: flex; align-items: center; gap: 12px;
  padding: 6px 8px 6px 16px; border-radius: 999px; font: 500 13px/1.4 var(--v-font); color: var(--v-text); }
.void-visit button { padding: 5px 14px; border-radius: 999px; border: 1px solid var(--v-line); background: var(--v-field); color: inherit;
  font: inherit; cursor: pointer; }
.void-visit button:hover { background: var(--v-hover); }
.void-visit button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
`;

/** A pill that says where we are visiting and takes us home. */
export function createVisitBar(spaceName: string, homeName: string, onBack: () => void): VisitBar {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  const root = document.createElement("div");
  root.className = "void-visit v-glass";
  const text = document.createElement("span");
  text.textContent = `Visiting ${spaceName}`;
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = `Back to ${homeName}`;
  back.addEventListener("click", onBack);
  root.append(text, back);
  document.body.append(root);
  return { destroy: () => root.remove() };
}
