// shared
import { PLAYER_STATUSES, STATUS_COLORS, STATUS_LABELS, type PlayerStatus } from "@void/shared";

// ui
import { ICONS } from "./icons";
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface AccountBar {
  setName(name: string): void;
  setStatus(status: PlayerStatus): void;
  /** Lights the People button while its panel is open. */
  setPeopleOpen(open: boolean): void;
  destroy(): void;
}

const STYLE_ID = "void-account-style";
const STYLES = `
.void-account { position: fixed; top: 14px; right: 14px; z-index: 900; display: flex; gap: 4px;
  align-items: center; padding: 4px 4px 4px 12px; border-radius: var(--v-radius); color: var(--v-text);
  font: 500 13px var(--v-font); }
.void-account__name { margin-right: 6px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.void-account button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0;
  border-radius: var(--v-radius-in); border: 0; background: transparent; color: var(--v-muted); cursor: pointer;
  transition: background 0.15s, color 0.15s; }
.void-account button:hover { background: var(--v-hover); color: var(--v-text); }
.void-account button[aria-pressed="true"] { background: rgb(139 147 255 / 0.22); color: var(--v-text); }
.void-account__status { position: relative; }
.void-account__dot { width: 12px; height: 12px; border-radius: 50%; display: block; }
.void-account__menu { position: absolute; top: calc(100% + 8px); right: 0; display: grid; gap: 2px; min-width: 190px;
  padding: 6px; border-radius: var(--v-radius); }
.void-account__menu[hidden] { display: none; }
.void-account__menu button { display: flex; width: auto; height: auto; gap: 10px; align-items: center; justify-content: flex-start;
  padding: 8px 10px; border-radius: var(--v-radius-sm); color: var(--v-text); font: 500 13px var(--v-font); }
.void-account__menu button[aria-checked="true"] { background: rgb(139 147 255 / 0.22); }
.void-account button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 1px; }
`;

export function createAccountBar(
  name: string,
  actions: {
    onStatus: (status: PlayerStatus) => void;
    onPeople: () => void;
    onSwitchSpace: () => void;
    onSettings: () => void;
    onSignOut: () => void;
  },
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
  // Status: a coloured dot that opens a small menu of the three choices.
  const statusWrap = document.createElement("div");
  statusWrap.className = "void-account__status";
  const statusButton = makeButton("Status", '<span class="void-account__dot"></span>', () => {
    menu.hidden = !menu.hidden;
  });
  const dot = statusButton.querySelector<HTMLElement>(".void-account__dot")!;
  const menu = document.createElement("div");
  menu.className = "void-account__menu v-glass";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  const choices = new Map<PlayerStatus, HTMLButtonElement>();
  for (const status of PLAYER_STATUSES) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.setAttribute("role", "menuitemradio");
    choice.innerHTML = `<span class="void-account__dot" style="background:${STATUS_COLORS[status]}"></span>`;
    choice.append(STATUS_LABELS[status]);
    choice.addEventListener("click", () => {
      menu.hidden = true;
      actions.onStatus(status);
    });
    choices.set(status, choice);
    menu.append(choice);
  }
  statusWrap.append(statusButton, menu);
  const closeMenu = (e: Event) => {
    if (!menu.hidden && !statusWrap.contains(e.target as Node)) menu.hidden = true;
  };
  const closeOnEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") menu.hidden = true;
  };
  document.addEventListener("pointerdown", closeMenu);
  document.addEventListener("keydown", closeOnEscape);
  const showStatus = (status: PlayerStatus) => {
    dot.style.background = STATUS_COLORS[status];
    statusButton.title = `Status: ${STATUS_LABELS[status]}`;
    for (const [s, choice] of choices) choice.setAttribute("aria-checked", String(s === status));
  };
  showStatus("available");
  const people = makeButton("People", ICONS.people, actions.onPeople);
  people.setAttribute("aria-pressed", "false");
  root.append(
    label,
    statusWrap,
    people,
    makeButton("Switch space", ICONS.spaces, actions.onSwitchSpace),
    makeButton("Settings", ICONS.settings, actions.onSettings),
    makeButton("Sign out", ICONS.signOut, actions.onSignOut),
  );
  document.body.append(root);
  return {
    setName: (next) => (label.textContent = next),
    setStatus: showStatus,
    setPeopleOpen: (open) => people.setAttribute("aria-pressed", String(open)),
    destroy() {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
      root.remove();
    },
  };
}
