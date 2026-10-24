// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface RoomBarActions {
  /** The person asked to lock or unlock the room they stand in. */
  onLock(locked: boolean): void;
  /** Someone inside answered a knock. */
  onAnswer(knockerId: string, allow: boolean): void;
}

export interface RoomBar {
  /** Shows the room you stand in and whether it is locked; undefined hides the bar. */
  setRoom(room: { name: string; locked: boolean } | undefined): void;
  /** Someone is knocking. A second knock from the same person replaces the first. */
  addKnock(knockerId: string, name: string): void;
  removeKnock(knockerId: string): void;
  destroy(): void;
}

const STYLE_ID = "void-room-bar-style";
const STYLES = `
.void-room-bar { position: fixed; top: 64px; left: 50%; z-index: 950; display: grid; gap: 8px; justify-items: center; transform: translateX(-50%); }
.void-room-bar > * { font: 500 13px/1.4 var(--v-font); color: var(--v-text); }
.void-room-pill, .void-knock { display: flex; align-items: center; gap: 10px; padding: 6px 8px 6px 14px; border-radius: 999px; }
.void-room-pill[hidden] { display: none; }
.void-room-bar button { padding: 6px 14px; border: 0; border-radius: 999px; font: 600 12px var(--v-font); cursor: pointer;
  background: var(--v-hover); color: var(--v-text); }
.void-room-bar button:hover { background: rgb(139 147 255 / 0.28); }
.void-room-bar button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
.void-knock { padding-left: 14px; }
.void-knock button[data-allow="false"] { color: var(--v-muted); }
`;

/** A pill with the room you are in and its lock, plus a card for each person knocking. */
export function createRoomBar(actions: RoomBarActions): RoomBar {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  const root = document.createElement("div");
  root.className = "void-room-bar";
  const pill = document.createElement("div");
  pill.className = "void-room-pill v-glass";
  pill.hidden = true;
  const label = document.createElement("span");
  const lock = document.createElement("button");
  lock.type = "button";
  pill.append(label, lock);
  root.append(pill);
  document.body.append(root);

  let locked = false;
  lock.addEventListener("click", () => actions.onLock(!locked));

  const knocks = new Map<string, HTMLElement>();
  const removeKnock = (knockerId: string) => {
    knocks.get(knockerId)?.remove();
    knocks.delete(knockerId);
  };

  return {
    setRoom(room) {
      pill.hidden = !room;
      if (!room) return;
      locked = room.locked;
      label.textContent = `${room.locked ? "🔒 " : ""}${room.name}`;
      lock.textContent = room.locked ? "Unlock" : "Lock room";
      lock.title = room.locked
        ? "Let anyone walk in again"
        : "Only people you let in can enter; they knock first";
    },
    addKnock(knockerId, name) {
      removeKnock(knockerId);
      const card = document.createElement("div");
      card.className = "void-knock v-glass";
      card.setAttribute("role", "alert");
      const text = document.createElement("span");
      text.textContent = `${name} is knocking`;
      const allow = document.createElement("button");
      allow.type = "button";
      allow.textContent = "Let in";
      const deny = document.createElement("button");
      deny.type = "button";
      deny.textContent = "Deny";
      deny.dataset.allow = "false";
      allow.addEventListener("click", () => actions.onAnswer(knockerId, true));
      deny.addEventListener("click", () => actions.onAnswer(knockerId, false));
      card.append(text, allow, deny);
      knocks.set(knockerId, card);
      root.append(card);
    },
    removeKnock,
    destroy() {
      root.remove();
    },
  };
}
