// systems
import type { Settings } from "../systems/settings";

// net
import type { DeviceKind, MediaDevice } from "../net/voice-connection";

// ui
import { buildAccountTab, type AccountContext } from "./settings-account";
import { buildSystemTab } from "./settings-system";

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
  background: rgb(11 11 16 / 0.7); font: 14px/1.4 system-ui, sans-serif; color: #f9fafb; }
.void-settings__panel { width: min(520px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
  display: grid; grid-template-rows: auto auto 1fr; border-radius: 12px; background: #111827;
  border: 1px solid #374151; overflow: hidden; }
.void-settings__head { display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 0; }
.void-settings h1 { margin: 0; font-size: 18px; }
.void-settings [role="tablist"] { display: flex; gap: 4px; padding: 12px 20px 0; border-bottom: 1px solid #374151; }
.void-settings [role="tab"] { padding: 8px 14px; border: 0; border-bottom: 2px solid transparent;
  background: none; color: #9ca3af; cursor: pointer; font: inherit; }
.void-settings [role="tab"][aria-selected="true"] { color: #f9fafb; border-bottom-color: #6ee7b7; }
.void-settings [role="tabpanel"] { padding: 20px; overflow-y: auto; display: grid; gap: 20px; align-content: start; }
.void-settings section { display: grid; gap: 12px; padding-bottom: 20px; border-bottom: 1px solid #1f2937; }
.void-settings section:last-child { border-bottom: 0; padding-bottom: 0; }
.void-settings h2 { margin: 0; font-size: 14px; }
.void-settings p { margin: 0; color: #9ca3af; }
.void-settings label { display: grid; gap: 6px; color: #9ca3af; }
.void-settings input:not([type="range"]), .void-settings select { padding: 8px 10px; border-radius: 8px;
  border: 1px solid #374151; background: #0b0b10; color: #f9fafb; font: inherit; }
.void-settings input[type="range"] { width: 100%; accent-color: #6ee7b7; }
.void-settings .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.void-settings button { padding: 8px 14px; border-radius: 8px; border: 1px solid #374151;
  background: #1f2937; color: #f9fafb; cursor: pointer; font: inherit; justify-self: start; }
.void-settings button.primary { background: #6ee7b7; border-color: #6ee7b7; color: #052e1f; font-weight: 600; }
.void-settings button.danger { background: #7f1d1d; border-color: #b91c1c; }
.void-settings button:disabled { opacity: 0.6; cursor: wait; }
.void-settings :focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
.void-settings .swatches { display: flex; gap: 10px; flex-wrap: wrap; }
.void-settings .swatch { width: 32px; height: 32px; padding: 0; border-radius: 50%; border: 2px solid transparent; }
.void-settings .swatch[aria-checked="true"] { border-color: #f9fafb; }
.void-settings .status { min-height: 1.4em; }
.void-settings .status[data-kind="error"] { color: #fca5a5; }
.void-settings .status[data-kind="success"] { color: #6ee7b7; }
`;

const TABS = [
  { id: "system", label: "System" },
  { id: "account", label: "Account" },
] as const;

/** Opens the settings dialog. Returns a function that closes it. */
export function openSettings(ctx: SettingsContext, onClose: () => void): () => void {
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
