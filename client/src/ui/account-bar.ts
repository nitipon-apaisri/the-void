// ui
import { ICONS } from "./icons";
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface AccountBar {
  setName(name: string): void;
  destroy(): void;
}

const STYLE_ID = "void-account-style";
const STYLES = `
.void-account { position: fixed; top: 14px; right: 14px; z-index: 900; display: flex; gap: 4px;
  align-items: center; padding: 5px 5px 5px 14px; border-radius: 999px; color: var(--v-text);
  font: 500 13px var(--v-font); }
.void-account__name { margin-right: 6px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.void-account button { display: grid; place-items: center; width: 34px; height: 34px; padding: 0;
  border-radius: 50%; border: 0; background: transparent; color: var(--v-muted); cursor: pointer;
  transition: background 0.15s, color 0.15s; }
.void-account button:hover { background: var(--v-hover); color: var(--v-text); }
.void-account button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 1px; }
`;

export function createAccountBar(
  name: string,
  actions: { onSettings: () => void; onSignOut: () => void },
): AccountBar {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  const root = document.createElement("div");
  root.className = "void-account v-glass";
  const label = document.createElement("span");
  label.className = "void-account__name";
  label.textContent = name;
  const makeButton = (text: string, icon: string, onClick: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = icon;
    button.title = text;
    button.setAttribute("aria-label", text);
    button.addEventListener("click", onClick);
    return button;
  };
  root.append(
    label,
    makeButton("Settings", ICONS.settings, actions.onSettings),
    makeButton("Sign out", ICONS.signOut, actions.onSignOut),
  );
  document.body.append(root);
  return {
    setName: (next) => (label.textContent = next),
    destroy: () => root.remove(),
  };
}
