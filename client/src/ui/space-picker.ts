// shared
import {
  DEFAULT_SIZE,
  DEFAULT_TEMPLATE,
  MAX_SPACE_NAME_LENGTH,
  normalizeInviteCode,
  SPACE_SIZES,
  SPACE_SIZE_INFO,
  SPACE_TEMPLATES,
  SPACE_TEMPLATE_INFO,
  type InviteResult,
  type SpaceSize,
  type SpaceSummary,
  type SpaceTemplate,
} from "@void/shared";

// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface SpacePickerActions {
  load(): Promise<SpaceSummary[]>;
  /** Throws an Error whose message is safe to display. */
  create(name: string, template: SpaceTemplate, size: SpaceSize): Promise<SpaceSummary>;
  /** Walls of a template's map for its thumbnail; undefined when it cannot be read. */
  preview(template: SpaceTemplate, size: SpaceSize): Promise<MapPreview | undefined>;
  /**
   * Uses a join code (already normalised). Undefined when the person declined the confirmation;
   * throws an Error whose message is safe to display when the code is no good.
   */
  redeem(code: string): Promise<InviteResult | undefined>;
}

export interface MapPreview {
  cols: number;
  rows: number;
  blocked: (col: number, row: number) => boolean;
}

const STYLE_ID = "void-space-picker-style";
const STYLES = `
.void-spaces { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; overflow: hidden;
  background: radial-gradient(900px 520px at 50% 0%, rgb(139 147 255 / 0.22), transparent 70%), var(--v-bg);
  font: 14px/1.4 var(--v-font); color: var(--v-text); animation: v-fade 0.5s ease-out; }
.void-spaces__panel { position: relative; z-index: 1; width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
  overflow-y: auto; padding: 28px; border-radius: 22px; display: grid; gap: 18px; }

/* Background: a faint dot grid that fades towards the edges, three orbits with a small body on
   each, and a few stars. Everything is decoration, so it stays quiet and sits under the panel. */
.void-sky { position: absolute; inset: 0; pointer-events: none; --ink: color-mix(in srgb, var(--v-text) 14%, transparent); }
.void-sky::before { content: ""; position: absolute; inset: 0;
  background-image: radial-gradient(color-mix(in srgb, var(--v-text) 24%, transparent) 1px, transparent 1.6px);
  background-size: 30px 30px;
  -webkit-mask-image: radial-gradient(ellipse 65% 55% at 50% 45%, #000 15%, transparent 78%);
  mask-image: radial-gradient(ellipse 65% 55% at 50% 45%, #000 15%, transparent 78%);
  animation: v-fade 1.4s ease-out; }
.void-sky i { position: absolute; left: 50%; top: 45%; translate: -50% -50%; border-radius: 50%;
  border: 1px solid var(--ink); animation: v-orbit var(--t) linear infinite, v-fade 1.2s ease-out; }
.void-sky i::after { content: ""; position: absolute; top: -3px; left: 50%; width: 5px; height: 5px; margin-left: -2.5px;
  border-radius: 50%; background: var(--v-accent); box-shadow: 0 0 10px 1px var(--v-accent); }
.void-sky i:nth-child(1) { width: 520px; height: 520px; --t: 60s; }
.void-sky i:nth-child(2) { width: 820px; height: 820px; --t: 110s; animation-direction: reverse, normal; }
.void-sky i:nth-child(2)::after { width: 4px; height: 4px; margin-left: -2px; opacity: 0.7; }
.void-sky i:nth-child(3) { width: 1160px; height: 1160px; --t: 170s; }
.void-sky i:nth-child(3)::after { width: 3px; height: 3px; margin-left: -1.5px; opacity: 0.5; }
.void-sky b { position: absolute; left: 0; top: 0; width: 2px; height: 2px; border-radius: 50%;
  background: color-mix(in srgb, var(--v-text) 70%, transparent); animation: v-twinkle 5s ease-in-out infinite;
  box-shadow: 8vw 14vh 0 0 var(--ink), 17vw 72vh 0 0 var(--ink), 26vw 30vh 0 0 var(--ink), 34vw 88vh 0 0 var(--ink),
    63vw 9vh 0 0 var(--ink), 71vw 81vh 0 0 var(--ink), 82vw 24vh 0 0 var(--ink), 91vw 60vh 0 0 var(--ink),
    12vw 52vh 0 0 var(--ink), 47vw 6vh 0 0 var(--ink), 55vw 93vh 0 0 var(--ink), 96vw 90vh 0 0 var(--ink); }
@keyframes v-orbit { to { rotate: 360deg; } }
@keyframes v-twinkle { 50% { opacity: 0.35; } }
@keyframes v-rise { from { opacity: 0; translate: 0 12px; } }
/* Each view's pieces come in one after another; a view that was hidden starts over when shown. */
.void-spaces section:not([hidden]) > * { animation: v-rise 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) backwards; animation-delay: calc(var(--i, 0) * 70ms + 60ms); }
.void-spaces h1 { animation: v-rise 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) backwards; }
@media (prefers-reduced-motion: reduce) {
  .void-spaces, .void-spaces *, .void-spaces *::before, .void-spaces *::after { animation: none !important; transition: none !important; }
}
.void-spaces h1 { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: -0.01em; }
.void-spaces h2 { margin: 0; font-size: 13px; font-weight: 650; letter-spacing: 0.02em; text-transform: uppercase; color: var(--v-muted); }
.void-spaces p { margin: 0; color: var(--v-muted); }
.void-spaces ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.void-spaces li button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 16px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-line); background: var(--v-field);
  color: var(--v-text); font: inherit; font-weight: 550; cursor: pointer; text-align: left; transition: background 0.15s, border-color 0.15s; }
.void-spaces li button:hover { background: var(--v-hover); border-color: var(--v-accent); }
.void-spaces .role { font-size: 12px; font-weight: 500; color: var(--v-muted); text-transform: capitalize; }
.void-spaces section { display: grid; gap: 12px; }
.void-spaces section[hidden] { display: none; }
.void-choices { grid-template-columns: repeat(2, 1fr); }
.void-choice { display: grid; gap: 6px; align-content: start; justify-items: start; padding: 18px 16px; border-radius: var(--v-radius);
  border: 1px solid var(--v-line); background: var(--v-field); color: var(--v-text); font: inherit; text-align: left; cursor: pointer;
  transition: background 0.15s, border-color 0.15s, translate 0.15s, transform 0.15s; }
.void-choice:hover { background: var(--v-hover); border-color: var(--v-accent); translate: 0 -2px; }
.void-choice:active { transform: scale(0.98); }
.void-choice strong { font-size: 16px; }
.void-choice span { color: var(--v-muted); line-height: 1.35; }
.void-spaces .back { justify-self: start; padding: 4px 10px 4px 6px; border: 0; border-radius: 999px; background: none;
  color: var(--v-muted); font: inherit; cursor: pointer; }
.void-spaces .back:hover { background: var(--v-hover); color: var(--v-text); }
.void-spaces .note { color: var(--v-text); min-height: 1.4em; }
.void-spaces input[name="code"] { text-transform: uppercase; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; }
.void-spaces form { display: flex; gap: 8px; }
@media (max-width: 420px) { .void-choices { grid-template-columns: 1fr; } }
.void-sizes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; }
.void-sizes button { display: grid; gap: 2px; justify-items: start; padding: 8px; border-radius: var(--v-radius-sm);
  border: 1px solid var(--v-line); background: var(--v-field); color: var(--v-text); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.void-sizes button:hover { background: var(--v-hover); }
.void-sizes button[aria-pressed="true"] { border-color: var(--v-accent); background: rgb(139 147 255 / 0.2); }
.void-sizes strong { font-size: 13px; }
.void-sizes span { color: var(--v-muted); line-height: 1.3; }
.void-templates { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 10px 0; }
.void-templates button { display: grid; gap: 6px; justify-items: start; align-content: start; padding: 8px; border-radius: var(--v-radius-sm);
  border: 1px solid var(--v-line); background: var(--v-field); color: var(--v-text); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.void-templates button:hover { background: var(--v-hover); }
.void-templates button[aria-pressed="true"] { border-color: var(--v-accent); background: rgb(139 147 255 / 0.2); }
.void-templates canvas { width: 100%; aspect-ratio: 90 / 67; border-radius: 6px; background: var(--v-bg); image-rendering: pixelated; }
.void-templates strong { font-size: 13px; }
.void-templates span { color: var(--v-muted); line-height: 1.3; }
.void-spaces input { flex: 1; min-width: 0; padding: 10px 13px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-line);
  background: var(--v-field); color: var(--v-text); font: inherit; }
.void-spaces input:focus { outline: none; border-color: var(--v-accent); }
.void-spaces .primary { padding: 10px 16px; border-radius: 999px; border: 0; cursor: pointer; background: var(--v-accent);
  color: var(--v-accent-ink); font: inherit; font-weight: 650; transition: filter 0.15s; }
.void-spaces .primary:hover:not(:disabled) { filter: brightness(1.1); }
.void-spaces .primary:disabled { opacity: 0.6; cursor: wait; }
.void-spaces .error { color: var(--v-danger); min-height: 1.4em; }
.void-spaces :focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
`;

// One pixel per tile: walls dark, floor light. The CSS scales it up without smoothing.
function drawPreview(canvas: HTMLCanvasElement, map: MapPreview) {
  canvas.width = map.cols;
  canvas.height = map.rows;
  canvas.style.aspectRatio = `${map.cols} / ${map.rows}`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#e9eaf3";
  ctx.fillRect(0, 0, map.cols, map.rows);
  ctx.fillStyle = "#3b3d57";
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++)
      if (map.blocked(col, row)) ctx.fillRect(col, row, 1, 1);
  }
}

/** Asks whether to join or create a space, then resolves with the one that was chosen. */
export function chooseSpace(actions: SpacePickerActions): Promise<SpaceSummary> {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  const overlay = document.createElement("div");
  overlay.className = "void-spaces";
  overlay.innerHTML = `
    <div class="void-sky" aria-hidden="true"><i></i><i></i><i></i><b></b></div>
    <div class="void-spaces__panel v-glass" role="dialog" aria-modal="true" aria-labelledby="void-spaces-title">
      <h1 id="void-spaces-title">Do you want to…</h1>
      <section class="void-choices" data-view="home">
        <button class="void-choice" type="button" data-go="join">
          <strong>Join a space</strong>
          <span>Open one you are in, or enter a code to join a new one.</span>
        </button>
        <button class="void-choice" type="button" data-go="create">
          <strong>Create a space</strong>
          <span>Start your own and invite people in.</span>
        </button>
      </section>
      <section data-view="join" hidden>
        <button class="back" type="button" data-go="home">← Back</button>
        <h2>Your spaces</h2>
        <ul data-list></ul>
        <p data-empty hidden>You are not in a space yet. Enter a code below to join one.</p>
        <h2>Join with a code</h2>
        <form data-code-form novalidate>
          <input name="code" maxlength="24" placeholder="Code, like K7M2P-9QXA4" aria-label="Join code" autocomplete="off" autocapitalize="characters" spellcheck="false" />
          <button class="primary" type="submit">Join</button>
        </form>
        <p class="note" data-note role="status"></p>
      </section>
      <section data-view="create" hidden>
        <button class="back" type="button" data-go="home">← Back</button>
        <div class="void-sizes" data-sizes role="group" aria-label="Size"></div>
        <div class="void-templates" data-templates role="group" aria-label="Style"></div>
        <form data-create-form novalidate>
          <input name="name" maxlength="${MAX_SPACE_NAME_LENGTH}" placeholder="Space name" aria-label="Space name" required />
          <button class="primary" type="submit">Create</button>
        </form>
      </section>
      <p class="error" role="alert"></p>
    </div>`;

  const q = <T extends Element>(selector: string) => overlay.querySelector<T>(selector)!;
  const list = q<HTMLUListElement>("[data-list]");
  const empty = q<HTMLElement>("[data-empty]");
  const error = q(".error");
  const form = q<HTMLFormElement>("[data-create-form]");
  const name = q<HTMLInputElement>("input[name=name]");
  const submit = q<HTMLButtonElement>("[data-create-form] .primary");
  const codeForm = q<HTMLFormElement>("[data-code-form]");
  const code = q<HTMLInputElement>("input[name=code]");
  const codeSubmit = q<HTMLButtonElement>("[data-code-form] .primary");
  const note = q("[data-note]");
  const title = q("#void-spaces-title");

  let template: SpaceTemplate = DEFAULT_TEMPLATE;
  let size: SpaceSize = DEFAULT_SIZE;
  const picks = new Map<SpaceTemplate, HTMLButtonElement>();
  const canvases = new Map<SpaceTemplate, HTMLCanvasElement>();
  // The thumbnails show the walls of the chosen size. A slow answer for an earlier size must not
  // overwrite the one for the size picked since.
  const drawPreviews = () => {
    const shown = size;
    for (const [id, canvas] of canvases) {
      void actions
        .preview(id, shown)
        .then((map) => map && shown === size && drawPreview(canvas, map));
    }
  };
  const sizePicks = new Map<SpaceSize, HTMLButtonElement>();
  for (const id of SPACE_SIZES) {
    const info = SPACE_SIZE_INFO[id];
    const button = document.createElement("button");
    button.type = "button";
    const title = document.createElement("strong");
    title.textContent = info.name;
    const blurb = document.createElement("span");
    blurb.textContent = info.blurb;
    button.append(title, blurb);
    button.addEventListener("click", () => {
      size = id;
      for (const [other, b] of sizePicks) b.setAttribute("aria-pressed", String(other === id));
      drawPreviews();
    });
    sizePicks.set(id, button);
    q("[data-sizes]").append(button);
  }
  sizePicks.get(size)!.setAttribute("aria-pressed", "true");
  for (const id of SPACE_TEMPLATES) {
    const info = SPACE_TEMPLATE_INFO[id];
    const button = document.createElement("button");
    button.type = "button";
    const canvas = document.createElement("canvas");
    const title = document.createElement("strong");
    title.textContent = info.name;
    const blurb = document.createElement("span");
    blurb.textContent = info.blurb;
    button.append(canvas, title, blurb);
    button.addEventListener("click", () => {
      template = id;
      for (const [other, b] of picks) b.setAttribute("aria-pressed", String(other === id));
    });
    picks.set(id, button);
    canvases.set(id, canvas);
    q("[data-templates]").append(button);
  }
  picks.get(template)!.setAttribute("aria-pressed", "true");

  type View = "home" | "join" | "create";
  const TITLES: Record<View, string> = {
    home: "Do you want to…",
    join: "Join a space",
    create: "Create a space",
  };
  let drawn = false;
  const show = (view: View) => {
    for (const section of overlay.querySelectorAll<HTMLElement>("[data-view]")) {
      section.hidden = section.dataset.view !== view;
    }
    title.textContent = TITLES[view];
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      title.animate(
        [
          { opacity: 0, translate: "0 6px" },
          { opacity: 1, translate: "0 0" },
        ],
        { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }
    overlay
      .querySelectorAll<HTMLElement>(`[data-view="${view}"] > *`)
      .forEach((child, i) => child.style.setProperty("--i", String(i)));
    error.textContent = "";
    note.textContent = "";
    // Reading the maps is only worth it for someone who is about to create a space.
    if (view === "create" && !drawn) {
      drawn = true;
      drawPreviews();
    }
    const focus = { home: ".void-choice", join: "input[name=code]", create: "input[name=name]" };
    overlay.querySelector<HTMLElement>(focus[view])?.focus();
    current = view;
  };
  let current: View = "home";
  for (const button of overlay.querySelectorAll<HTMLElement>("[data-go]")) {
    button.addEventListener("click", () => show(button.dataset.go as View));
  }
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current !== "home") show("home");
  });

  return new Promise((resolve) => {
    const finish = (space: SpaceSummary) => {
      overlay.remove();
      resolve(space);
    };

    const render = (spaces: SpaceSummary[]) => {
      empty.hidden = spaces.length > 0;
      list.replaceChildren(
        ...spaces.map((space) => {
          const item = document.createElement("li");
          const button = document.createElement("button");
          button.type = "button";
          const label = document.createElement("span");
          label.textContent = space.name;
          const role = document.createElement("span");
          role.className = "role";
          role.textContent = space.role;
          button.append(label, role);
          button.addEventListener("click", () => finish(space));
          item.append(button);
          return item;
        }),
      );
    };

    const load = () => {
      error.textContent = "";
      actions.load().then(render, (err) => {
        error.textContent = err instanceof Error ? err.message : "Could not load your spaces";
      });
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.textContent = "";
      submit.disabled = true;
      try {
        finish(await actions.create(name.value, template, size));
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : "Something went wrong";
        submit.disabled = false;
      }
    });

    codeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.textContent = "";
      note.textContent = "";
      const typed = normalizeInviteCode(code.value);
      if (!typed) {
        error.textContent =
          "That is not a join code. It has 10 letters and digits, like K7M2P-9QXA4.";
        return;
      }
      codeSubmit.disabled = true;
      try {
        const result = await actions.redeem(typed);
        if (result?.status === "joined") {
          finish(result.space);
          return;
        }
        if (result) {
          note.textContent = `Asked to join ${result.spaceName}. An admin will let you in.`;
          code.value = "";
        }
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : "Could not use that code";
      }
      codeSubmit.disabled = false;
    });

    document.body.append(overlay);
    show("home");
    load();
  });
}
