// shared
import {
  canChangeRole,
  canRemoveMember,
  type JoinRequest,
  type SpaceMember,
  type SpaceRole,
} from "@void/shared";

// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface PeoplePanel {
  setMembers(members: readonly SpaceMember[]): void;
  /** Accounts that are in the room right now. */
  setOnline(userIds: ReadonlySet<string>): void;
  /** Owners and admins see the Invite button and the people waiting to be let in. */
  setCanManage(can: boolean): void;
  setRequests(requests: readonly JoinRequest[]): void;
  /** Who is looking, which decides the actions each row offers. */
  setViewer(userId: string, role: SpaceRole): void;
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
  onInvite(): void;
  /** Resolves when the server has recorded the decision. */
  onDecide(userId: string, approve: boolean): Promise<void>;
  /** The caller confirms and talks to the server; resolves when done. */
  onSetRole(member: SpaceMember, role: SpaceRole): Promise<void>;
  onRemove(member: SpaceMember): Promise<void>;
  /** The viewer leaves the space (any role but owner). */
  onLeave(): void;
}

const STYLE_ID = "void-people-style";
const STYLES = `
.void-people { position: fixed; top: 64px; right: 14px; z-index: 880; width: 280px; max-height: calc(100vh - 140px);
  display: none; flex-direction: column; gap: 10px; padding: 14px; border-radius: var(--v-radius);
  font: 13px/1.4 var(--v-font); color: var(--v-text); }
.void-people[data-open="true"] { display: flex; }
.void-people input { padding: 8px 12px; border-radius: 999px; border: 1px solid var(--v-line); background: var(--v-field);
  color: var(--v-text); font: inherit; }
.void-people input:focus { outline: none; border-color: var(--v-accent); }
.void-people__list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: grid; gap: 2px; align-content: start; }
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
.void-people__item { display: grid; }
.void-people__line { display: flex; align-items: center; gap: 2px; }
.void-people__line .void-people__row { flex: 1; min-width: 0; }
.void-people__more { flex: none; width: 28px; height: 28px; border: 0; border-radius: 50%; background: none; color: var(--v-muted);
  font: inherit; font-size: 16px; line-height: 1; cursor: pointer; }
.void-people__more:hover, .void-people__more[aria-expanded="true"] { background: var(--v-hover); color: var(--v-text); }
.void-people__menu { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 8px 8px 26px; }
.void-people__menu button { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--v-line); background: var(--v-field);
  color: var(--v-text); font: inherit; font-size: 12px; cursor: pointer; }
.void-people__menu button:hover:not(:disabled) { background: var(--v-hover); }
.void-people__menu button.danger { color: var(--v-danger, #e5484d); }
.void-people__menu button:disabled { opacity: 0.5; cursor: wait; }
.void-people__leave { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--v-line); background: none;
  color: var(--v-muted); font: inherit; font-size: 12px; cursor: pointer; justify-self: start; }
.void-people__leave:hover { background: var(--v-hover); color: var(--v-text); }
.void-people__leave[hidden] { display: none; }
.void-people__empty { margin: 8px 6px; color: var(--v-muted); }
.void-people__invite { padding: 8px 12px; border-radius: 999px; border: 1px solid var(--v-line); background: var(--v-field);
  color: var(--v-text); font: inherit; font-weight: 550; cursor: pointer; }
.void-people__invite:hover { background: var(--v-hover); }
.void-people__invite[hidden] { display: none; }
.void-people__ask { display: flex; align-items: center; gap: 6px; padding: 6px 8px; }
.void-people__ask .void-people__name { flex: 1; }
.void-people__ask button { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--v-line); background: var(--v-field);
  color: var(--v-text); font: inherit; font-size: 12px; cursor: pointer; }
.void-people__ask button:hover:not(:disabled) { background: var(--v-hover); }
.void-people__ask button.yes { background: var(--v-accent); border-color: var(--v-accent); color: var(--v-accent-ink); font-weight: 650; }
.void-people__ask button:disabled { opacity: 0.5; cursor: wait; }
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
  const invite = document.createElement("button");
  invite.type = "button";
  invite.className = "void-people__invite";
  invite.textContent = "Invite people";
  invite.hidden = true;
  invite.addEventListener("click", () => actions.onInvite());
  const leave = document.createElement("button");
  leave.type = "button";
  leave.className = "void-people__leave";
  leave.textContent = "Leave space";
  leave.hidden = true;
  leave.addEventListener("click", () => actions.onLeave());
  root.append(invite, search, list, leave);
  document.body.append(root);

  let members: readonly SpaceMember[] = [];
  let online: ReadonlySet<string> = new Set();
  let requests: readonly JoinRequest[] = [];
  let canManage = false;
  let viewer: { userId: string; role: SpaceRole } | undefined;
  // The person whose actions are showing.
  let menuFor: string | undefined;

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

    const item = document.createElement("div");
    item.className = "void-people__item";
    const line = document.createElement("div");
    line.className = "void-people__line";
    line.append(button);
    item.append(line);
    const available = viewer ? menuOptions(member) : [];
    if (available.length > 0) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "void-people__more";
      more.textContent = "⋯";
      more.setAttribute("aria-label", `Actions for ${member.name}`);
      more.setAttribute("aria-expanded", String(menuFor === member.userId));
      more.addEventListener("click", () => {
        menuFor = menuFor === member.userId ? undefined : member.userId;
        render();
      });
      line.append(more);
      if (menuFor === member.userId) item.append(menu(available));
    }
    return item;
  };

  // What the viewer may do to this person, from the same rules the server enforces.
  const menuOptions = (member: SpaceMember) => {
    if (!viewer || member.userId === viewer.userId) return [];
    const options: { label: string; danger?: boolean; run: () => Promise<void> }[] = [];
    const setRole = (role: SpaceRole, label: string) => {
      if (canChangeRole(viewer!.role, member.role, role, false)) {
        options.push({ label, run: () => actions.onSetRole(member, role) });
      }
    };
    setRole("admin", "Make admin");
    setRole("member", "Make member");
    setRole("owner", "Make owner");
    if (canRemoveMember(viewer.role, member.role, false)) {
      options.push({ label: "Remove", danger: true, run: () => actions.onRemove(member) });
    }
    return options;
  };

  const menu = (options: ReturnType<typeof menuOptions>) => {
    const box = document.createElement("div");
    box.className = "void-people__menu";
    for (const option of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.label;
      if (option.danger) button.className = "danger";
      button.addEventListener("click", async () => {
        box.querySelectorAll("button").forEach((b) => (b.disabled = true));
        try {
          await option.run();
          menuFor = undefined;
        } catch {
          // The caller shows the reason; the menu stays so it can be tried again.
        }
        render();
      });
      box.append(button);
    }
    return box;
  };

  const section = (title: string, rows: HTMLElement[]) => {
    if (rows.length === 0) return [];
    const heading = document.createElement("h2");
    heading.textContent = `${title} · ${rows.length}`;
    return [heading, ...rows];
  };

  const ask = (request: JoinRequest) => {
    const line = document.createElement("div");
    line.className = "void-people__ask";
    const name = document.createElement("span");
    name.className = "void-people__name";
    name.textContent = request.name;
    const decide = (approve: boolean) => async () => {
      const buttons = line.querySelectorAll("button");
      buttons.forEach((b) => (b.disabled = true));
      try {
        await actions.onDecide(request.userId, approve);
      } catch {
        // The caller shows the reason; let the admin try again.
        buttons.forEach((b) => (b.disabled = false));
      }
    };
    const yes = document.createElement("button");
    yes.type = "button";
    yes.className = "yes";
    yes.textContent = "Let in";
    yes.addEventListener("click", decide(true));
    const no = document.createElement("button");
    no.type = "button";
    no.textContent = "Decline";
    no.addEventListener("click", decide(false));
    line.append(name, yes, no);
    return line;
  };

  const render = () => {
    const needle = search.value.trim().toLowerCase();
    const shown = members.filter((m) => !needle || m.name.toLowerCase().includes(needle));
    const on = shown.filter((m) => online.has(m.userId)).map((m) => row(m, true));
    const off = shown.filter((m) => !online.has(m.userId)).map((m) => row(m, false));
    const waiting = canManage ? requests.map(ask) : [];
    const nodes = [
      ...section("Waiting to join", waiting),
      ...section("Online", on),
      ...section("Offline", off),
    ];
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
    setCanManage(can) {
      canManage = can;
      invite.hidden = !can;
      render();
    },
    setViewer(userId, role) {
      viewer = { userId, role };
      leave.hidden = role === "owner";
      render();
    },
    setRequests(next) {
      requests = next;
      render();
    },
    toggle: () => setOpen(root.dataset.open !== "true"),
    isOpen: () => root.dataset.open === "true",
    destroy: () => root.remove(),
  };
}
