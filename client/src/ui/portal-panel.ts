// ui
import { ICONS } from "./icons";
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export type PortalTool = { kind: "portal"; targetId: string };

export interface PlacedPortal {
  id: string;
  targetId: string;
  targetName: string;
  closed: boolean;
}

export interface PortalPanel {
  /** Shows the launcher (hiding closes the panel); `canLink` shows the owner's links button. */
  setAvailable(available: boolean, canLink?: boolean): void;
  /** The linked spaces a portal can lead to. */
  setTargets(targets: readonly { id: string; name: string }[]): void;
  /** The portals in this space; a space that already has one is left out of the place list. */
  setPortals(portals: readonly PlacedPortal[]): void;
  close(): void;
  destroy(): void;
}

export interface PortalPanelActions {
  /** The panel opened or closed. */
  onToggle(open: boolean): void;
  /** The chosen tool changed; undefined means nothing is selected. */
  onTool(tool: PortalTool | undefined): void;
  /** Close a portal (it stays, but nobody can enter) or open it again. */
  onSetClosed(portalId: string, closed: boolean): void;
  /** Take a placed portal off the map. */
  onRemove(portalId: string): void;
  /** The owner wants the window for connecting to other spaces. */
  onLinks(): void;
}

const STYLE_ID = "void-portal-style";
const STYLES = `
.void-portal-btn { position: fixed; right: 14px; bottom: 330px; z-index: 900; display: none; place-items: center; width: 48px; height: 48px;
  padding: 0; border-radius: var(--v-radius-sm); color: var(--v-muted); cursor: pointer; }
.void-portal-btn[data-available="true"] { display: grid; }
.void-portal-btn:hover { color: var(--v-text); }
.void-portal-btn[aria-pressed="true"] { background: rgb(139 147 255 / 0.28); color: var(--v-text); }
.void-portal-btn:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
.void-portal { position: fixed; right: 72px; bottom: 208px; z-index: 900; width: 280px; max-width: calc(100vw - 96px);
  padding: 14px; border-radius: var(--v-radius); font: 500 13px/1.4 var(--v-font); color: var(--v-text); display: grid; gap: 4px; }
.void-portal[hidden] { display: none; }
.void-portal p { margin: 0 2px 6px; color: var(--v-muted); font-size: 12px; line-height: 1.4; }
.void-portal h2 { margin: 0 2px 4px; color: var(--v-muted); font: 600 11px var(--v-font); letter-spacing: 0.08em; text-transform: uppercase; }
.void-portal__list { display: grid; gap: 4px; max-height: 180px; overflow-y: auto; }
.void-portal button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 1px solid transparent;
  border-radius: var(--v-radius-sm); background: var(--v-field); color: var(--v-text); font: inherit; text-align: left; cursor: pointer; }
.void-portal button:hover:not(:disabled) { background: var(--v-hover); }
.void-portal button:disabled { opacity: 0.6; cursor: default; }
.void-portal button[aria-pressed="true"] { border-color: var(--v-accent); background: rgb(139 147 255 / 0.2); }
.void-portal__open { display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 10px; border-radius: var(--v-radius-sm); background: var(--v-field); }
.void-portal__open[data-closed] .void-portal__name { color: var(--v-muted); }
.void-portal .void-portal__open button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; flex: none; background: none; color: var(--v-muted); }
.void-portal .void-portal__open button:hover:not(:disabled) { background: var(--v-hover); color: var(--v-text); }
.void-portal .void-portal__open button[data-remove]:hover:not(:disabled) { background: var(--v-danger-bg); color: var(--v-danger); }
.void-portal .void-portal__open button[data-closed-toggle][aria-pressed="true"] { color: var(--v-accent); }
.void-portal__open svg { width: 16px; height: 16px; }
.void-portal button svg { flex: none; width: 16px; height: 16px; color: var(--v-muted); }
.void-portal button[aria-pressed="true"] svg { color: var(--v-accent); }
.void-portal__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.void-portal__empty { margin: 2px 2px 6px; color: var(--v-muted); font-size: 12px; }
.void-portal__foot { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--v-line); }
.void-portal__foot button { justify-content: center; background: none; color: var(--v-muted); }
.void-portal__foot button:hover:not(:disabled) { color: var(--v-text); }
.void-portal [hidden] { display: none; }
.void-portal :focus-visible { outline: 2px solid var(--v-accent); outline-offset: 1px; }
`;

/** A launcher and a small panel for portals to linked spaces, apart from decorating. */
export function createPortalPanel(actions: PortalPanelActions): PortalPanel {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "void-portal-btn v-glass";
  launcher.innerHTML = ICONS.portal;
  launcher.title = "Portals and connected spaces";
  launcher.setAttribute("aria-label", "Portals and connected spaces");
  launcher.setAttribute("aria-pressed", "false");

  const panel = document.createElement("div");
  panel.className = "void-portal v-glass";
  panel.hidden = true;
  panel.innerHTML = `<h2>Portals</h2>
<p>Doors to connected spaces. Lock one to keep people out, or add a new one with +.</p>
<div class="void-portal__list" data-open></div>
<div class="void-portal__list" data-list></div>
<div class="void-portal__empty" data-empty hidden></div>
<div class="void-portal__foot" data-foot hidden><button type="button" data-links>${ICONS.link}<span>Connected spaces…</span></button></div>`;
  const q = <T extends HTMLElement>(sel: string) => panel.querySelector<T>(sel)!;
  let targets: readonly { id: string; name: string }[] = [];
  let placed = new Set<string>();
  const list = q("[data-list]");
  const empty = q("[data-empty]");
  const open = q("[data-open]");
  const foot = q("[data-foot]");
  q("[data-links]").addEventListener("click", () => actions.onLinks());

  // Only one space is armed at a time.
  const rows = () => [...list.querySelectorAll<HTMLButtonElement>("button")];
  const arm = (button: HTMLButtonElement, tool: PortalTool) => {
    const on = button.getAttribute("aria-pressed") !== "true";
    for (const b of rows()) b.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-pressed", String(on));
    actions.onTool(on ? tool : undefined);
  };

  // A space that already has a portal is not offered again.
  const renderTargets = () => {
    const free = targets.filter((t) => !placed.has(t.id));
    list.replaceChildren(
      ...free.map((t) => {
        const row = document.createElement("button");
        row.type = "button";
        row.setAttribute("aria-pressed", "false");
        row.innerHTML = `${ICONS.plus}<span class="void-portal__name"></span>`;
        row.querySelector(".void-portal__name")!.textContent = t.name;
        row.title = `Add a portal to ${t.name}: click the map to place it, Esc to finish`;
        row.addEventListener("click", () => arm(row, { kind: "portal", targetId: t.id }));
        return row;
      }),
    );
    list.hidden = free.length === 0;
    empty.textContent =
      targets.length === 0 ? "No connected spaces yet." : "Every connected space has a portal.";
    // Say nothing when portals are listed above; the heading and rows are enough.
    empty.hidden = targets.length > 0 || open.childElementCount > 0;
  };

  const setOpen = (open: boolean) => {
    if (!panel.hidden === open) return;
    panel.hidden = !open;
    launcher.setAttribute("aria-pressed", String(open));
    if (!open) {
      for (const b of rows()) b.setAttribute("aria-pressed", "false");
      actions.onTool(undefined);
    }
    actions.onToggle(open);
  };
  launcher.addEventListener("click", () => setOpen(Boolean(panel.hidden)));
  document.body.append(launcher, panel);

  return {
    setTargets(next) {
      targets = next;
      renderTargets();
    },
    setPortals(portals) {
      placed = new Set(portals.map((p) => p.targetId));
      open.replaceChildren(
        ...portals.map((p) => {
          const row = document.createElement("div");
          row.className = "void-portal__open";
          row.toggleAttribute("data-closed", p.closed);
          const name = document.createElement("span");
          name.className = "void-portal__name";
          name.textContent = p.targetName;
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.dataset.closedToggle = "";
          toggle.setAttribute("aria-pressed", String(p.closed));
          toggle.innerHTML = p.closed ? ICONS.lock : ICONS.unlock;
          const label = p.closed
            ? `Closed: nobody can enter. Click to open it`
            : `Open. Click to close it, so nobody can enter (it stays on the map)`;
          toggle.title = label;
          toggle.setAttribute("aria-label", label);
          toggle.addEventListener("click", () => actions.onSetClosed(p.id, !p.closed));
          const remove = document.createElement("button");
          remove.type = "button";
          remove.dataset.remove = "";
          remove.innerHTML = ICONS.trash;
          remove.title = `Remove the portal to ${p.targetName} from the map`;
          remove.setAttribute("aria-label", remove.title);
          remove.addEventListener("click", () => actions.onRemove(p.id));
          row.append(name, toggle, remove);
          return row;
        }),
      );
      renderTargets();
    },
    setAvailable(available, canLink = false) {
      foot.hidden = !canLink;
      launcher.dataset.available = String(available);
      if (!available) setOpen(false);
    },
    close: () => setOpen(false),
    destroy() {
      launcher.remove();
      panel.remove();
    },
  };
}
