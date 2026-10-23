// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export type ToastKind = "info" | "success" | "error";

export interface Toast {
  /** Shows a message. Without `autoHideMs` it stays until hide() or the next show(). */
  show(message: string, kind?: ToastKind, autoHideMs?: number): void;
  hide(): void;
  destroy(): void;
}

const STYLE_ID = "void-toast-style";
const STYLES = `
.void-toast {
  position: fixed; top: 18px; left: 50%; z-index: 1000;
  transform: translate(-50%, -12px); opacity: 0; pointer-events: none;
  max-width: min(480px, calc(100vw - 32px)); padding: 10px 18px; border-radius: 999px;
  font: 500 13px/1.4 var(--v-font); color: var(--v-text);
  background: var(--v-glass); border: 1px solid var(--v-line); box-shadow: var(--v-shadow);
  -webkit-backdrop-filter: var(--v-blur); backdrop-filter: var(--v-blur);
  transition: opacity 0.2s, transform 0.2s;
}
.void-toast[data-visible="true"] { transform: translate(-50%, 0); opacity: 1; }
.void-toast[data-kind="error"] { color: var(--v-danger); border-color: rgb(255 107 129 / 0.4); }
.void-toast[data-kind="success"] { color: var(--v-on); border-color: rgb(94 234 212 / 0.35); }
@media (prefers-reduced-motion: reduce) { .void-toast { transition: none; } }
`;

export function createToast(): Toast {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  const el = document.createElement("div");
  el.className = "void-toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  document.body.append(el);

  let timer: number | undefined;
  const clearTimer = () => window.clearTimeout(timer);

  const hide = () => {
    clearTimer();
    el.dataset.visible = "false";
  };

  return {
    show(message, kind = "info", autoHideMs) {
      clearTimer();
      el.textContent = message;
      el.dataset.kind = kind;
      el.dataset.visible = "true";
      if (autoHideMs) timer = window.setTimeout(hide, autoHideMs);
    },
    hide,
    destroy() {
      clearTimer();
      el.remove();
    },
  };
}
