// shared
import type { DesktopBridge, ScreenSource } from "@void/shared";

// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

const STYLE_ID = "void-screen-picker-style";
const STYLES = `
.void-picker { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center;
  background: rgb(8 9 16 / 0.6); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  font: 14px/1.4 var(--v-font); color: var(--v-text); }
.void-picker__dialog { width: min(740px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
  padding: 24px; border-radius: var(--v-radius); background: var(--v-glass-solid); border: 1px solid var(--v-line);
  box-shadow: var(--v-shadow); display: grid; gap: 16px; }
.void-picker h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
.void-picker h3 { margin: 0; font-size: 12px; color: var(--v-muted); font-weight: 650; letter-spacing: 0.02em; text-transform: uppercase; }
.void-picker__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.void-picker__item { display: grid; gap: 8px; padding: 8px; border-radius: var(--v-radius); border: 1px solid var(--v-line);
  background: var(--v-field); color: inherit; cursor: pointer; font: inherit; text-align: left;
  transition: border-color 0.15s, background 0.15s; }
.void-picker__item:hover, .void-picker__item:focus-visible { border-color: var(--v-accent); background: var(--v-hover); outline: none; }
.void-picker__item img { width: 100%; aspect-ratio: 16 / 10; object-fit: contain; background: #000; border-radius: var(--v-radius-sm); }
.void-picker__item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px 2px; }
.void-picker__note { margin: 0; padding: 10px 14px; border-radius: var(--v-radius-sm); background: rgb(251 191 36 / 0.14); color: #fde68a; }
.void-picker__sound { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: center; cursor: pointer; }
.void-picker__sound small { grid-column: 2; color: var(--v-muted); }
.void-picker__actions { display: flex; gap: 8px; justify-content: flex-end; }
.void-picker button.plain { padding: 8px 18px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-line);
  background: var(--v-field); color: var(--v-text); cursor: pointer; font: inherit; font-weight: 500; }
.void-picker button.plain:hover { background: var(--v-hover); }
.void-picker button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
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
 * Resolves with whether they also chose to share the computer's sound.
 * Rejects with a NotAllowedError if they cancel.
 */
export async function chooseScreenSource(bridge: DesktopBridge): Promise<boolean> {
  applyTheme();
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

  // Off by default: the sound is everything the computer plays, including the people in this
  // call, so without headphones they would hear themselves a moment later.
  const sound = document.createElement("label");
  sound.className = "void-picker__sound";
  const soundBox = document.createElement("input");
  soundBox.type = "checkbox";
  const soundText = document.createElement("span");
  soundText.textContent = "Share sound from this computer";
  const soundHint = document.createElement("small");
  soundHint.textContent = "Use headphones, or the people you hear will hear themselves.";
  sound.append(soundBox, soundText, soundHint);

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

  return new Promise<boolean>((resolve, reject) => {
    const finish = (error?: unknown) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      if (error) reject(error);
      else resolve(soundBox.checked);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(cancelled());
    };
    const pick = (id: string) =>
      bridge.selectScreenSource(id, soundBox.checked).then(() => finish(), finish);

    const screens = sources.filter((source) => source.kind === "screen");
    const windows = sources.filter((source) => source.kind === "window");
    if (screens.length) dialog.append(section("Screens", screens, pick));
    if (windows.length) dialog.append(section("Windows", windows, pick));
    dialog.append(sound, actions);

    cancel.addEventListener("click", () => finish(cancelled()));
    document.addEventListener("keydown", onKey);
    dialog.querySelector<HTMLElement>(".void-picker__item")?.focus();
  });
}
