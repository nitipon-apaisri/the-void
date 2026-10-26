// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
}

const STYLE_ID = "void-confirm-style";
const STYLES = `
.void-confirm { position: fixed; inset: 0; z-index: 2100; display: grid; place-items: center;
  font: 14px/1.4 var(--v-font); color: var(--v-text); }
.void-confirm__panel { width: min(400px, calc(100vw - 32px)); padding: 24px; border-radius: var(--v-radius); display: grid; gap: 14px; }
.void-confirm h1 { margin: 0; font-size: 18px; font-weight: 650; }
.void-confirm p { margin: 0; color: var(--v-muted); }
.void-confirm__actions { display: flex; justify-content: flex-end; gap: 8px; }
.void-confirm button { padding: 9px 18px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-line); background: var(--v-field);
  color: var(--v-text); font: inherit; font-weight: 500; cursor: pointer; }
.void-confirm button:hover { background: var(--v-hover); }
.void-confirm button.primary { background: var(--v-accent); border-color: var(--v-accent); color: var(--v-accent-ink); font-weight: 650; }
.void-confirm :focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
`;

/** A small yes/no dialog. Resolves true on confirm; Escape or the other button gives false. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  const overlay = document.createElement("div");
  overlay.className = "void-confirm v-scrim";
  overlay.innerHTML = `
    <div class="void-confirm__panel v-glass" role="alertdialog" aria-modal="true" aria-labelledby="void-confirm-title">
      <h1 id="void-confirm-title"></h1>
      <p></p>
      <div class="void-confirm__actions">
        <button type="button" data-no></button>
        <button type="button" class="primary" data-yes></button>
      </div>
    </div>`;
  overlay.querySelector("h1")!.textContent = options.title;
  overlay.querySelector("p")!.textContent = options.body;
  overlay.querySelector("[data-no]")!.textContent = options.cancelLabel ?? "Not now";
  overlay.querySelector("[data-yes]")!.textContent = options.confirmLabel;
  const opener = document.activeElement as HTMLElement | null;

  return new Promise((resolve) => {
    const finish = (answer: boolean) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      opener?.focus();
      resolve(answer);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };
    overlay.querySelector("[data-no]")!.addEventListener("click", () => finish(false));
    overlay.querySelector("[data-yes]")!.addEventListener("click", () => finish(true));
    document.addEventListener("keydown", onKey);
    document.body.append(overlay);
    overlay.querySelector<HTMLButtonElement>("[data-yes]")!.focus();
  });
}
