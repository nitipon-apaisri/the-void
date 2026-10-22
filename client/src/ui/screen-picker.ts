// shared
import type { DesktopBridge, ScreenSource } from "@void/shared";

// utils
import { injectStyle } from "../utils/dom";

const STYLE_ID = "void-screen-picker-style";
const STYLES = `
.void-picker { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center;
  background: rgb(11 11 16 / 0.85); font: 14px/1.4 system-ui, sans-serif; color: #f9fafb; }
.void-picker__dialog { width: min(720px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
  padding: 24px; border-radius: 12px; background: #111827; border: 1px solid #374151; display: grid; gap: 16px; }
.void-picker h2 { margin: 0; font-size: 18px; }
.void-picker h3 { margin: 0; font-size: 13px; color: #9ca3af; font-weight: 600; }
.void-picker__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.void-picker__item { display: grid; gap: 6px; padding: 8px; border-radius: 8px; border: 1px solid #374151;
  background: #1f2937; color: inherit; cursor: pointer; font: inherit; text-align: left; }
.void-picker__item:hover, .void-picker__item:focus-visible { border-color: #6ee7b7; outline: none; }
.void-picker__item img { width: 100%; aspect-ratio: 16 / 10; object-fit: contain; background: #000; border-radius: 4px; }
.void-picker__item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.void-picker__note { margin: 0; padding: 10px 12px; border-radius: 8px; background: #422006; color: #fde68a; }
.void-picker__actions { display: flex; gap: 8px; justify-content: flex-end; }
.void-picker button.plain { padding: 8px 14px; border-radius: 8px; border: 1px solid #374151;
  background: #1f2937; color: #f9fafb; cursor: pointer; font: inherit; }
.void-picker button:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
`;

/** The person closed the picker without choosing; same error a browser gives on cancel. */
const cancelled = () => new DOMException("Screen sharing was cancelled", "NotAllowedError");

function section(title: string, items: ScreenSource[], pick: (id: string) => void) {
  const wrap = document.createElement("section");
  const heading = document.createElement("h3");
  heading.textContent = title;
  const grid = document.createElement("div");
  grid.className = "void-picker__grid";
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "void-picker__item";
    const img = document.createElement("img");
    img.alt = "";
    img.src = item.thumbnail;
    const label = document.createElement("span");
    label.textContent = item.name;
    label.title = item.name;
    button.append(img, label);
    button.addEventListener("click", () => pick(item.id));
    grid.append(button);
  }
  wrap.append(heading, grid);
  return wrap;
}

/**
 * Desktop only: asks the person which screen or window to share and registers the choice
 * with the shell, so the getDisplayMedia call that follows is answered with it.
 * Rejects with a NotAllowedError if they cancel.
 */
export async function chooseScreenSource(bridge: DesktopBridge): Promise<void> {
  injectStyle(STYLE_ID, STYLES);
  const { sources, needsPermission } = await bridge.listScreenSources();

  const overlay = document.createElement("div");
  overlay.className = "void-picker";
  const dialog = document.createElement("div");
  dialog.className = "void-picker__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "void-picker-title");
  const title = document.createElement("h2");
  title.id = "void-picker-title";
  title.textContent = "Share your screen";
  dialog.append(title);

  const actions = document.createElement("div");
  actions.className = "void-picker__actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "plain";
  cancel.textContent = "Cancel";
  actions.append(cancel);

  if (needsPermission) {
    const note = document.createElement("p");
    note.className = "void-picker__note";
    note.textContent =
      "macOS needs Screen Recording permission before others can see your screen. Allow The Void in System Settings, restart the app, then try again.";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "plain";
    open.textContent = "Open System Settings";
    open.addEventListener("click", () => void bridge.openScreenSettings());
    dialog.append(note);
    actions.prepend(open);
  }

  document.body.append(overlay);
  overlay.append(dialog);

  return new Promise<void>((resolve, reject) => {
    const finish = (error?: unknown) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      if (error) reject(error);
      else resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(cancelled());
    };
    const pick = (id: string) => bridge.selectScreenSource(id).then(() => finish(), finish);

    const screens = sources.filter((source) => source.kind === "screen");
    const windows = sources.filter((source) => source.kind === "window");
    if (screens.length) dialog.append(section("Screens", screens, pick));
    if (windows.length) dialog.append(section("Windows", windows, pick));
    dialog.append(actions);

    cancel.addEventListener("click", () => finish(cancelled()));
    document.addEventListener("keydown", onKey);
    dialog.querySelector<HTMLElement>(".void-picker__item")?.focus();
  });
}
