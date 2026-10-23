// shared
import { MAX_SPACE_NAME_LENGTH, type SpaceSummary } from "@void/shared";

// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface SpacePickerActions {
  load(): Promise<SpaceSummary[]>;
  /** Throws an Error whose message is safe to display. */
  create(name: string): Promise<SpaceSummary>;
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
        finish(await actions.create(name.value));
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : "Something went wrong";
        submit.disabled = false;
      }
    });

    document.body.append(overlay);
    load();
  });
}
