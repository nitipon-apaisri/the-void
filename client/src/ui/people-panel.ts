// shared
import type { SpaceMember } from "@void/shared";

// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface PeoplePanel {
  setMembers(members: readonly SpaceMember[]): void;
  /** Accounts that are in the room right now. */
  setOnline(userIds: ReadonlySet<string>): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

export interface PeoplePanelActions {
  /** A name was clicked. Only people who are online can be walked to. */
  onGoTo(userId: string): void;
  /** The search box has focus, so the game must stop reading the keyboard. */
  onTyping(on: boolean): void;
  onToggle(open: boolean): void;
}

const STYLE_ID = "void-people-style";
const STYLES = `
.void-people { position: fixed; top: 64px; right: 14px; z-index: 880; width: 280px; max-height: calc(100vh - 140px);
  display: none; grid-template-rows: auto 1fr; gap: 10px; padding: 14px; border-radius: var(--v-radius);
  font: 13px/1.4 var(--v-font); color: var(--v-text); }
.void-people[data-open="true"] { display: grid; }
.void-people input { padding: 8px 12px; border-radius: 999px; border: 1px solid var(--v-line); background: var(--v-field);
  color: var(--v-text); font: inherit; }
.void-people input:focus { outline: none; border-color: var(--v-accent); }
.void-people__list { overflow-y: auto; display: grid; gap: 2px; align-content: start; }
.void-people h2 { margin: 8px 6px 4px; font-size: 11px; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; color: var(--v-muted); }
.void-people__row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; border: 0; border-radius: var(--v-radius-sm);
  background: none; color: inherit; font: inherit; text-align: left; }
.void-people__row[data-online="true"] { cursor: pointer; }
.void-people__row[data-online="true"]:hover { background: var(--v-hover); }
.void-people__row[data-online="false"] { color: var(--v-muted); cursor: default; }
.void-people__dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--v-muted); opacity: 0.45; }
.void-people__row[data-online="true"] .void-people__dot { background: var(--v-on); opacity: 1; box-shadow: 0 0 8px var(--v-on); }
.void-people__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.void-people__role { font-size: 11px; color: var(--v-muted); text-transform: capitalize; }
.void-people__empty { margin: 8px 6px; color: var(--v-muted); }
.void-people :focus-visible { outline: 2px solid var(--v-accent); outline-offset: 1px; }
`;

/** Everyone in the space, online first, with a search box. Hidden until toggled. */
export function createPeoplePanel(actions: PeoplePanelActions): PeoplePanel {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  const root = document.createElement("aside");
  root.className = "void-people v-glass";
  root.setAttribute("aria-label", "People");
  root.dataset.open = "false";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search people";
  search.setAttribute("aria-label", "Search people");
  search.maxLength = 40;
  const list = document.createElement("div");
  list.className = "void-people__list";
  root.append(search, list);
  document.body.append(root);

  let members: readonly SpaceMember[] = [];
  let online: ReadonlySet<string> = new Set();

  const row = (member: SpaceMember, isOnline: boolean) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "void-people__row";
    button.dataset.online = String(isOnline);
    button.disabled = !isOnline;
    const dot = document.createElement("span");
    dot.className = "void-people__dot";
    const name = document.createElement("span");
    name.className = "void-people__name";
    name.textContent = member.name;
    const role = document.createElement("span");
    role.className = "void-people__role";
    role.textContent = member.role === "member" ? "" : member.role;
    button.append(dot, name, role);
    if (isOnline) button.addEventListener("click", () => actions.onGoTo(member.userId));
    return button;
  };

  const section = (title: string, rows: HTMLElement[]) => {
    if (rows.length === 0) return [];
    const heading = document.createElement("h2");
    heading.textContent = `${title} · ${rows.length}`;
    return [heading, ...rows];
  };

  const render = () => {
    const needle = search.value.trim().toLowerCase();
    const shown = members.filter((m) => !needle || m.name.toLowerCase().includes(needle));
    const on = shown.filter((m) => online.has(m.userId)).map((m) => row(m, true));
    const off = shown.filter((m) => !online.has(m.userId)).map((m) => row(m, false));
    const nodes = [...section("Online", on), ...section("Offline", off)];
    if (nodes.length === 0) {
      const none = document.createElement("p");
      none.className = "void-people__empty";
      none.textContent = needle ? "No one matches." : "No one here yet.";
      nodes.push(none);
    }
    list.replaceChildren(...nodes);
  };

  search.addEventListener("input", render);
  search.addEventListener("focus", () => actions.onTyping(true));
  search.addEventListener("blur", () => actions.onTyping(false));
  search.addEventListener("keydown", (e) => {
    // Escape leaves the box first, then closes the panel.
    if (e.key === "Escape") {
      if (search.value) {
        search.value = "";
        render();
      } else {
        search.blur();
        setOpen(false);
      }
    }
  });

  const setOpen = (open: boolean) => {
    root.dataset.open = String(open);
    if (!open) search.blur();
    actions.onToggle(open);
  };
  render();

  return {
    setMembers(next) {
      members = next;
      render();
    },
    setOnline(next) {
      online = next;
      render();
    },
    toggle: () => setOpen(root.dataset.open !== "true"),
    isOpen: () => root.dataset.open === "true",
    destroy: () => root.remove(),
  };
}
