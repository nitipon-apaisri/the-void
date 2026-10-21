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
  position: fixed; top: 16px; left: 50%; z-index: 1000;
  transform: translate(-50%, -12px); opacity: 0; pointer-events: none;
  max-width: min(480px, calc(100vw - 32px)); padding: 10px 16px; border-radius: 8px;
  font: 14px/1.4 system-ui, sans-serif; color: #f9fafb; background: #1f2937;
  border: 1px solid #374151; box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
  transition: opacity 0.2s, transform 0.2s;
}
.void-toast[data-visible="true"] { transform: translate(-50%, 0); opacity: 1; }
.void-toast[data-kind="error"] { background: #7f1d1d; border-color: #b91c1c; }
.void-toast[data-kind="success"] { background: #064e3b; border-color: #047857; }
@media (prefers-reduced-motion: reduce) { .void-toast { transition: none; } }
`;

export function createToast(): Toast {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLES;
    document.head.append(style);
  }

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
