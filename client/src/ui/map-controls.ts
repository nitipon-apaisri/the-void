// ui
import { ICONS } from "./icons";
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface MapControls {
  /** Lights the mini map button while the mini map is showing. */
  setMinimapShown(shown: boolean): void;
  destroy(): void;
}

export interface MapControlActions {
  onZoomIn(): void;
  onZoomOut(): void;
  onLocate(): void;
  onToggleMinimap(): void;
}

const STYLE_ID = "void-map-controls-style";
const STYLES = `
.void-mapctl { position: fixed; right: 14px; bottom: 18px; z-index: 900; display: grid; gap: 2px; padding: 5px;
  border-radius: 999px; }
.void-mapctl button { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: var(--v-muted); cursor: pointer; transition: background 0.15s, color 0.15s; }
.void-mapctl button:hover { background: var(--v-hover); color: var(--v-text); }
.void-mapctl button[aria-pressed="true"] { background: rgb(139 147 255 / 0.22); color: var(--v-text); }
.void-mapctl button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 1px; }
.void-mapctl hr { width: 18px; margin: 3px auto; border: 0; border-top: 1px solid var(--v-line); }
`;

/** Floating buttons at the bottom right: zoom, find yourself, and the mini map. */
export function createMapControls(actions: MapControlActions): MapControls {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  const root = document.createElement("div");
  root.className = "void-mapctl v-glass";
  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "Map");

  const button = (label: string, icon: string, onClick: () => void) => {
    const el = document.createElement("button");
    el.type = "button";
    el.innerHTML = icon;
    el.title = label;
    el.setAttribute("aria-label", label);
    el.addEventListener("click", onClick);
    return el;
  };
  const minimap = button("Mini map", ICONS.map, actions.onToggleMinimap);
  minimap.setAttribute("aria-pressed", "true");
  root.append(
    button("Zoom in", ICONS.plus, actions.onZoomIn),
    button("Zoom out", ICONS.minus, actions.onZoomOut),
    document.createElement("hr"),
    button("Show me", ICONS.locate, actions.onLocate),
    minimap,
  );
  document.body.append(root);
  return {
    setMinimapShown: (shown) => minimap.setAttribute("aria-pressed", String(shown)),
    destroy: () => root.remove(),
  };
}
