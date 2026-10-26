// systems
import type { Settings } from "../systems/settings";

// net
import type { DeviceKind, MediaDevice } from "../net/voice-connection";

// ui
import { buildAccountTab, type AccountContext } from "./settings-account";
import { buildSystemTab } from "./settings-system";
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface SettingsContext {
  settings: Settings;
  onSettingsChange(next: Settings): void;
  listDevices(kind: DeviceKind): Promise<MediaDevice[]>;
  /** Defaults the System tab can reset to. */
  defaults: Settings;
  account: AccountContext;
}

const STYLE_ID = "void-settings-style";
const STYLES = `
.void-settings { position: fixed; inset: 0; z-index: 1500; display: grid; place-items: center;
  background: rgb(8 9 16 / 0.6); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  font: 14px/1.4 var(--v-font); color: var(--v-text); }
.void-settings__panel { width: min(540px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
  display: grid; grid-template-rows: auto auto 1fr auto; border-radius: var(--v-radius); background: var(--v-glass-solid);
  border: 1px solid var(--v-line); box-shadow: var(--v-shadow); overflow: hidden; }
.void-settings__head { display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 0; }
.void-settings h1 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
.void-settings [role="tablist"] { display: flex; gap: 6px; padding: 14px 24px 0; }
.void-settings [role="tab"] { padding: 5px 12px; border: 0; border-radius: var(--v-radius-sm);
  background: none; color: var(--v-muted); cursor: pointer; font: inherit; font-weight: 500; transition: background 0.15s, color 0.15s; }
.void-settings [role="tab"]:hover { background: var(--v-hover); color: var(--v-text); }
.void-settings [role="tab"][aria-selected="true"] { background: rgb(139 147 255 / 0.2); color: var(--v-text); }
.void-settings [role="tabpanel"] { padding: 20px 24px 24px; overflow-y: auto; display: grid; gap: 20px; align-content: start; }
.void-settings section { display: grid; gap: 12px; padding-bottom: 20px; border-bottom: 1px solid var(--v-line); }
.void-settings section:last-child { border-bottom: 0; padding-bottom: 0; }
.void-settings__credit { padding: 12px 24px; border-top: 1px solid var(--v-line); font-size: 12px; color: var(--v-muted); }
.void-settings h2 { margin: 0; font-size: 13px; font-weight: 650; letter-spacing: 0.02em; text-transform: uppercase; color: var(--v-muted); }
.void-settings p { margin: 0; color: var(--v-muted); }
.void-settings label { display: grid; gap: 6px; color: var(--v-muted); }
.void-settings input:not([type="range"]), .void-settings select { padding: 9px 12px; border-radius: var(--v-radius-sm);
  border: 1px solid var(--v-line); background: var(--v-field); color: var(--v-text); font: inherit; }
.void-settings select option { background: var(--v-glass-solid); }
.void-settings input:not([type="range"]):focus, .void-settings select:focus { outline: none; border-color: var(--v-accent); }
.void-settings input[type="range"] { width: 100%; accent-color: var(--v-accent); }
.void-settings .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.void-settings button { padding: 8px 16px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-line);
  background: var(--v-field); color: var(--v-text); cursor: pointer; font: inherit; font-weight: 500; justify-self: start;
  transition: background 0.15s, filter 0.15s; }
.void-settings button:hover:not(:disabled) { background: var(--v-hover); }
.void-settings button.primary { background: var(--v-accent); border-color: var(--v-accent); color: var(--v-accent-ink); font-weight: 650; }
.void-settings button.primary:hover:not(:disabled) { background: var(--v-accent); filter: brightness(1.1); }
.void-settings button.danger { background: var(--v-danger-bg); border-color: rgb(255 107 129 / 0.4); color: var(--v-danger); }
.void-settings button:disabled { opacity: 0.6; cursor: wait; }
.void-settings :focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
.void-settings .status { min-height: 1.4em; }
.void-settings .status[data-kind="error"] { color: var(--v-danger); }
.void-settings .status[data-kind="success"] { color: var(--v-on); }
`;

const TABS = [
  { id: "system", label: "System" },
  { id: "account", label: "Account" },
] as const;

/** Opens the settings dialog. Returns a function that closes it. */
export function openSettings(ctx: SettingsContext, onClose: () => void): () => void {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  const opener = document.activeElement as HTMLElement | null;

  const overlay = document.createElement("div");
  overlay.className = "void-settings";
  overlay.innerHTML = `
    <div class="void-settings__panel" role="dialog" aria-modal="true" aria-labelledby="void-settings-title">
      <div class="void-settings__head">
        <h1 id="void-settings-title">Settings</h1>
        <button type="button" data-close>Close</button>
      </div>
      <div role="tablist" aria-label="Settings sections"></div>
      <div role="tabpanel"></div>
      <p class="void-settings__credit">Art: Modern Interiors by LimeZu (limezu.itch.io)</p>
    </div>`;

  const tablist = overlay.querySelector<HTMLElement>("[role=tablist]")!;
  const panel = overlay.querySelector<HTMLElement>("[role=tabpanel]")!;
  const tabs = TABS.map(({ id, label }) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `void-settings-tab-${id}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "void-settings-panel");
    tab.textContent = label;
    tab.addEventListener("click", () => select(id));
    tablist.append(tab);
    return tab;
  });
  panel.id = "void-settings-panel";

  const select = (id: (typeof TABS)[number]["id"]) => {
    TABS.forEach((t, i) => {
      tabs[i].setAttribute("aria-selected", String(t.id === id));
      tabs[i].tabIndex = t.id === id ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", `void-settings-tab-${id}`);
    panel.replaceChildren(id === "system" ? buildSystemTab(ctx) : buildAccountTab(ctx.account));
  };

  // Arrow keys move between tabs, as the tab pattern expects.
  tablist.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const current = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    const next = (current + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    select(TABS[next].id);
    tabs[next].focus();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    opener?.focus();
    onClose();
  }

  overlay.querySelector("[data-close]")!.addEventListener("click", close);
  // Only a click that starts on the backdrop closes it, not a drag that ends there.
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);

  select("system");
  document.body.append(overlay);
  tabs[0].focus();
  return close;
}
