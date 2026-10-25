// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface Stage {
  /** A presenter's screen arrived (or was replaced). It opens large, and the newest is in front. */
  show(playerId: string, name: string, el: HTMLMediaElement): void;
  /** The element ended. Does nothing when the player's screen is a different, newer one. */
  remove(playerId: string, el: HTMLMediaElement): void;
  removePlayer(playerId: string): void;
  /** Keeps the title in step with a name change. */
  rename(playerId: string, name: string): void;
  destroy(): void;
}

const STYLE_ID = "void-stage-style";
const STYLES = `
.void-stage { position: fixed; top: 64px; left: 50%; z-index: 880; transform: translateX(-50%); display: grid; gap: 8px;
  width: min(960px, calc(100vw - 32px)); padding: 10px; border-radius: var(--v-radius); font: 500 13px/1.4 var(--v-font); color: var(--v-text); }
.void-stage[hidden] { display: none; }
.void-stage__bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.void-stage__title { font-weight: 600; margin-right: auto; }
.void-stage__bar button { padding: 4px 12px; border: 0; border-radius: 999px; background: var(--v-hover); color: inherit; font: 600 12px var(--v-font); cursor: pointer; }
.void-stage__bar button[aria-pressed="true"] { background: rgb(139 147 255 / 0.28); }
.void-stage__bar button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
.void-stage__screen { display: grid; }
.void-stage__screen video { width: 100%; max-height: calc(100vh - 260px); aspect-ratio: 16 / 9; object-fit: contain;
  border-radius: 10px; background: #000; }
`;

/** A large view of what someone is presenting, with a switch when more than one is. */
export function createStage(): Stage {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  const root = document.createElement("div");
  root.className = "void-stage v-glass";
  root.hidden = true;
  const bar = document.createElement("div");
  bar.className = "void-stage__bar";
  const title = document.createElement("span");
  title.className = "void-stage__title";
  const tabs = document.createElement("span");
  tabs.className = "void-stage__bar";
  const hide = document.createElement("button");
  hide.type = "button";
  hide.textContent = "Hide";
  hide.addEventListener("click", () => (root.hidden = true));
  bar.append(title, tabs, hide);
  const screen = document.createElement("div");
  screen.className = "void-stage__screen";
  root.append(bar, screen);
  document.body.append(root);

  const screens = new Map<string, { name: string; el: HTMLMediaElement }>();
  let current: string | undefined;

  const render = () => {
    const entry = current && screens.get(current);
    root.hidden = root.hidden || !entry;
    if (!entry) {
      title.textContent = "";
      screen.replaceChildren();
      tabs.replaceChildren();
      root.hidden = true;
      return;
    }
    title.textContent = `${entry.name} is presenting`;
    if (screen.firstChild !== entry.el) screen.replaceChildren(entry.el);
    tabs.replaceChildren(
      ...(screens.size > 1
        ? [...screens].map(([id, s]) => {
            const tab = document.createElement("button");
            tab.type = "button";
            tab.textContent = s.name;
            tab.setAttribute("aria-pressed", String(id === current));
            tab.addEventListener("click", () => {
              current = id;
              render();
            });
            return tab;
          })
        : []),
    );
  };

  const drop = (playerId: string) => {
    screens.delete(playerId);
    if (current === playerId) current = [...screens.keys()].pop();
    render();
  };

  return {
    show(playerId, name, el) {
      el.setAttribute("aria-label", `${name}'s shared screen`);
      screens.set(playerId, { name, el });
      current = playerId;
      root.hidden = false;
      render();
    },
    remove(playerId, el) {
      if (screens.get(playerId)?.el === el) drop(playerId);
    },
    removePlayer: drop,
    rename(playerId, name) {
      const entry = screens.get(playerId);
      if (!entry || entry.name === name) return;
      entry.name = name;
      render();
    },
    destroy: () => root.remove(),
  };
}
