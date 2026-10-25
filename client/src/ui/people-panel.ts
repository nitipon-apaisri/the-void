// shared
import {
  canBanMember,
  canChangeRole,
  canModerateMember,
  canRemoveMember,
  type BannedMember,
  type JoinRequest,
  type ModerateAction,
  type SpaceMember,
  type PlayerStatus,
  type SpaceRole,
  STATUS_LABELS,
} from "@void/shared";

// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface PeoplePanel {
  setMembers(members: readonly SpaceMember[]): void;
  /** Accounts that are in the room right now. */
  setOnline(userIds: ReadonlySet<string>): void;
  /** Accounts sharing their screen as a presentation right now. */
  setPresenting(userIds: ReadonlySet<string>): void;
  /** Away and do-not-disturb people by account id; anyone missing is available. */
  setStatuses(statuses: ReadonlyMap<string, PlayerStatus>): void;
  /** Owners and admins see the Invite button and the people waiting to be let in. */
  setCanManage(can: boolean): void;
  setRequests(requests: readonly JoinRequest[]): void;
  /** Owners and admins see who is banned and may lift it. */
  setBans(bans: readonly BannedMember[]): void;
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
  onBan(member: SpaceMember): Promise<void>;
  /** Ask an online person to switch their mic off, or to stop presenting. */
  onModerate(member: SpaceMember, action: ModerateAction): Promise<void>;
  onUnban(userId: string): Promise<void>;
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
.void-people__pop { position: fixed; z-index: 890; width: 200px; display: flex; flex-direction: column; gap: 2px; padding: 6px;
  border-radius: var(--v-radius-sm); font: 13px/1.4 var(--v-font); color: var(--v-text); }
.void-people__pop[hidden] { display: none; }
.void-people__pop header { display: flex; align-items: baseline; gap: 6px; padding: 6px 8px 8px; border-bottom: 1px solid var(--v-line); margin-bottom: 4px; }
.void-people__pop header b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
.void-people__pop button { padding: 7px 8px; border: 0; border-radius: var(--v-radius-sm); background: none; color: inherit;
  font: inherit; text-align: left; cursor: pointer; }
.void-people__pop button:hover:not(:disabled), .void-people__pop button:focus-visible { background: var(--v-hover); }
.void-people__pop button.danger { color: var(--v-danger, #e5484d); }
.void-people__pop button:disabled { opacity: 0.5; cursor: wait; }
.void-people__pop hr { width: 100%; margin: 4px 0; border: 0; border-top: 1px solid var(--v-line); }
.void-people__line { display: flex; align-items: center; gap: 2px; }
.void-people__line .void-people__row { flex: 1; min-width: 0; }
.void-people__line:has([aria-expanded="true"]) .void-people__row { background: var(--v-hover); }
.void-people__more { flex: none; width: 28px; height: 28px; border: 0; border-radius: 50%; background: none; color: var(--v-muted);
  font: inherit; font-size: 16px; line-height: 1; cursor: pointer; }
.void-people__more:hover, .void-people__more[aria-expanded="true"] { background: var(--v-hover); color: var(--v-text); }
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
  let presenting: ReadonlySet<string> = new Set();
  let statuses: ReadonlyMap<string, PlayerStatus> = new Map();
  let requests: readonly JoinRequest[] = [];
  let bans: readonly BannedMember[] = [];
  let canManage = false;
  let viewer: { userId: string; role: SpaceRole } | undefined;

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
    if (online.has(member.userId) && canModerateMember(viewer.role, member.role)) {
      options.push({ label: "Mute", run: () => actions.onModerate(member, "mute") });
      if (presenting.has(member.userId)) {
        options.push({
          label: "Stop presenting",
          run: () => actions.onModerate(member, "stop-presenting"),
        });
      }
    }
    if (canRemoveMember(viewer.role, member.role, false)) {
      options.push({ label: "Remove", danger: true, run: () => actions.onRemove(member) });
    }
    if (canBanMember(viewer.role, member.role)) {
      options.push({ label: "Ban", danger: true, run: () => actions.onBan(member) });
    }
    return options;
  };

  // Lives on <body>: the panel's blur would make a fixed child position against the panel.
  const pop = document.createElement("div");
  pop.className = "void-people__pop v-glass";
  pop.setAttribute("role", "menu");
  pop.hidden = true;
  document.body.append(pop);
  // The person whose popover is open, and the state it was built from.
  let menuFor: string | undefined;
  let menuShape = "";

  const rowOf = (userId: string) =>
    list.querySelector<HTMLElement>(`[data-user-id="${CSS.escape(userId)}"]`);

  // The row and its ⋯ button both open the popover, so both report it.
  const setExpanded = (userId: string, open: boolean) =>
    rowOf(userId)
      ?.querySelectorAll("[aria-haspopup]")
      .forEach((el) => el.setAttribute("aria-expanded", String(open)));

  const closeMenu = (refocus = false) => {
    if (menuFor === undefined) return;
    const line = rowOf(menuFor);
    setExpanded(menuFor, false);
    menuFor = undefined;
    menuShape = "";
    pop.hidden = true;
    if (refocus) line?.querySelector<HTMLElement>(".void-people__more")?.focus();
  };

  // Left of the panel when there is room, otherwise over its edge; level with the row.
  const placeMenu = () => {
    const row = menuFor === undefined ? null : rowOf(menuFor);
    if (!row) return closeMenu();
    const at = row.getBoundingClientRect();
    const panel = root.getBoundingClientRect();
    const room = panel.left - pop.offsetWidth - 8;
    pop.style.left = `${room >= 8 ? room : Math.max(8, panel.left + 8)}px`;
    const top = room >= 8 ? at.top : at.bottom + 4;
    pop.style.top = `${Math.max(8, Math.min(top, window.innerHeight - pop.offsetHeight - 8))}px`;
  };

  const buildMenu = (member: SpaceMember, isOnline: boolean) => {
    const head = document.createElement("header");
    const title = document.createElement("b");
    title.textContent = member.name;
    const role = document.createElement("span");
    role.className = "void-people__role";
    role.textContent = member.role;
    head.append(title, role);

    const items: { label: string; danger?: boolean; run: () => void | Promise<void> }[] = [];
    if (isOnline) items.push({ label: "Walk to them", run: () => actions.onGoTo(member.userId) });
    const manage = menuOptions(member);
    const buttons: HTMLButtonElement[] = [];
    const nodes: HTMLElement[] = [head];
    for (const [i, option] of [...items, ...manage].entries()) {
      // A rule between the harmless actions and the ones that remove someone.
      if (option.danger && !manage[i - items.length - 1]?.danger) {
        nodes.push(document.createElement("hr"));
      }
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.textContent = option.label;
      if (option.danger) button.className = "danger";
      button.addEventListener("click", async () => {
        buttons.forEach((b) => (b.disabled = true));
        try {
          await option.run();
          closeMenu();
        } catch {
          // The caller shows the reason; the menu stays so it can be tried again.
          buttons.forEach((b) => (b.disabled = false));
        }
      });
      buttons.push(button);
      nodes.push(button);
    }
    pop.replaceChildren(...nodes);
    return buttons;
  };

  const shapeOf = (member: SpaceMember, isOnline: boolean) =>
    `${member.userId}:${member.role}:${isOnline}:${viewer?.role}`;

  const openMenu = (member: SpaceMember, isOnline: boolean) => {
    closeMenu();
    menuFor = member.userId;
    menuShape = shapeOf(member, isOnline);
    const buttons = buildMenu(member, isOnline);
    pop.hidden = false;
    setExpanded(member.userId, true);
    placeMenu();
    buttons[0]?.focus();
  };

  const row = (member: SpaceMember, isOnline: boolean) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "void-people__row";
    button.dataset.online = String(isOnline);
    const manageable = menuOptions(member).length > 0;
    // Someone who is offline and cannot be managed has nothing to click for.
    button.disabled = !isOnline && !manageable;
    const dot = document.createElement("span");
    dot.className = "void-people__dot";
    const name = document.createElement("span");
    name.className = "void-people__name";
    name.textContent = member.name;
    const role = document.createElement("span");
    role.className = "void-people__role";
    const roleText = member.role === "member" ? "" : member.role;
    const status = statuses.get(member.userId);
    role.textContent = [
      roleText,
      presenting.has(member.userId) ? "presenting" : "",
      status && status !== "available" && isOnline ? STATUS_LABELS[status].toLowerCase() : "",
    ]
      .filter(Boolean)
      .join(" · ");
    button.append(dot, name, role);
    const line = document.createElement("div");
    line.className = "void-people__line";
    line.dataset.userId = member.userId;
    line.append(button);
    if (manageable) {
      const toggle = () => {
        if (menuFor === member.userId) closeMenu();
        else openMenu(member, isOnline);
      };
      const more = document.createElement("button");
      more.type = "button";
      more.className = "void-people__more";
      more.textContent = "⋯";
      more.setAttribute("aria-label", `Actions for ${member.name}`);
      for (const el of [button, more]) {
        el.setAttribute("aria-haspopup", "menu");
        el.setAttribute("aria-expanded", String(menuFor === member.userId));
        el.addEventListener("click", toggle);
      }
      line.append(more);
    } else if (isOnline) {
      // Nothing to manage: one click still just walks to them.
      button.addEventListener("click", () => actions.onGoTo(member.userId));
    }
    return line;
  };

  // The popover outlives list re-renders; rebuild it only if what it shows has changed.
  const syncMenu = () => {
    if (menuFor === undefined) return;
    const member = members.find((m) => m.userId === menuFor);
    if (!member) return closeMenu();
    const isOnline = online.has(member.userId);
    if (menuOptions(member).length === 0) return closeMenu();
    if (menuShape !== shapeOf(member, isOnline)) {
      menuShape = shapeOf(member, isOnline);
      buildMenu(member, isOnline);
    }
    setExpanded(member.userId, true);
    placeMenu();
  };

  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as Node;
    // A row or its ⋯ handles its own click (open, or close if it is the open one).
    if (menuFor === undefined || pop.contains(target)) return;
    if ((target as HTMLElement).closest?.(".void-people__line")) return;
    closeMenu();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || menuFor === undefined) return;
    // A confirm dialog opened from the popover takes its own Escape.
    const focus = document.activeElement;
    if (!focus || (!pop.contains(focus) && !root.contains(focus))) return;
    e.stopPropagation();
    closeMenu(true);
  };
  const onResize = () => closeMenu();
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("resize", onResize);
  list.addEventListener("scroll", () => closeMenu());

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

  const banned = (ban: BannedMember) => {
    const line = document.createElement("div");
    line.className = "void-people__ask";
    const name = document.createElement("span");
    name.className = "void-people__name";
    name.textContent = ban.name;
    const lift = document.createElement("button");
    lift.type = "button";
    lift.textContent = "Unban";
    lift.addEventListener("click", async () => {
      lift.disabled = true;
      try {
        await actions.onUnban(ban.userId);
      } catch {
        // The caller shows the reason; let the admin try again.
        lift.disabled = false;
      }
    });
    line.append(name, lift);
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
      ...section("Banned", canManage ? bans.map(banned) : []),
    ];
    if (nodes.length === 0) {
      const none = document.createElement("p");
      none.className = "void-people__empty";
      none.textContent = needle ? "No one matches." : "No one here yet.";
      nodes.push(none);
    }
    list.replaceChildren(...nodes);
    syncMenu();
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
    if (!open) {
      search.blur();
      closeMenu();
    }
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
    setStatuses(next) {
      statuses = next;
      render();
    },
    setPresenting(next) {
      presenting = next;
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
    setBans(next) {
      bans = next;
      render();
    },
    toggle: () => setOpen(root.dataset.open !== "true"),
    isOpen: () => root.dataset.open === "true",
    destroy() {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onResize);
      pop.remove();
      root.remove();
    },
  };
}
