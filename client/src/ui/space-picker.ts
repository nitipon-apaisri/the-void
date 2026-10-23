// shared
import {
  DEFAULT_TEMPLATE,
  MAX_SPACE_NAME_LENGTH,
  SPACE_TEMPLATES,
  SPACE_TEMPLATE_INFO,
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
  create(name: string, template: SpaceTemplate): Promise<SpaceSummary>;
  /** Walls of a template's map for its thumbnail; undefined when it cannot be read. */
  preview(template: SpaceTemplate): Promise<MapPreview | undefined>;
}

export interface MapPreview {
  cols: number;
  rows: number;
  blocked: (col: number, row: number) => boolean;
}

const STYLE_ID = "void-space-picker-style";
const STYLES = `
.void-spaces { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center;
  background: radial-gradient(900px 520px at 50% 0%, rgb(139 147 255 / 0.22), transparent 70%), var(--v-bg);
  font: 14px/1.4 var(--v-font); color: var(--v-text); }
.void-spaces__panel { width: min(460px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto;
  padding: 28px; border-radius: 22px; display: grid; gap: 18px; }
.void-spaces h1 { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: -0.01em; }
.void-spaces h2 { margin: 0; font-size: 13px; font-weight: 650; letter-spacing: 0.02em; text-transform: uppercase; color: var(--v-muted); }
.void-spaces p { margin: 0; color: var(--v-muted); }
.void-spaces ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.void-spaces li button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 16px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-line); background: var(--v-field);
  color: var(--v-text); font: inherit; font-weight: 550; cursor: pointer; text-align: left; transition: background 0.15s, border-color 0.15s; }
.void-spaces li button:hover { background: var(--v-hover); border-color: var(--v-accent); }
.void-spaces .role { font-size: 12px; font-weight: 500; color: var(--v-muted); text-transform: capitalize; }
.void-spaces form { display: flex; gap: 8px; }
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

/** Lists your spaces and lets you create one. Resolves with the one that was chosen. */
export function chooseSpace(actions: SpacePickerActions): Promise<SpaceSummary> {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  const overlay = document.createElement("div");
  overlay.className = "void-spaces";
  overlay.innerHTML = `
    <div class="void-spaces__panel v-glass" role="dialog" aria-modal="true" aria-labelledby="void-spaces-title">
      <h1 id="void-spaces-title">Choose a space</h1>
      <section>
        <ul data-list></ul>
        <p data-empty hidden>You are not in a space yet. Create one below.</p>
      </section>
      <section>
        <h2>Create a space</h2>
        <div class="void-templates" data-templates role="group" aria-label="Style"></div>
        <form novalidate>
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
  const form = q<HTMLFormElement>("form");
  const name = q<HTMLInputElement>("input[name=name]");
  const submit = q<HTMLButtonElement>(".primary");

  let template: SpaceTemplate = DEFAULT_TEMPLATE;
  const picks = new Map<SpaceTemplate, HTMLButtonElement>();
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
    q("[data-templates]").append(button);
    void actions.preview(id).then((map) => map && drawPreview(canvas, map));
  }
  picks.get(template)!.setAttribute("aria-pressed", "true");

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
        finish(await actions.create(name.value, template));
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : "Something went wrong";
        submit.disabled = false;
      }
    });

    document.body.append(overlay);
    load();
  });
}
