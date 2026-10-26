// utils
import { injectStyle } from "../utils/dom";

// ui
import { applyTheme } from "./theme";

const STYLE_ID = "void-tooltip";
const DELAY_MS = 350;
const GAP = 8;
const EDGE = 8;

const STYLES = `
.void-tooltip { position: fixed; z-index: 3000; max-width: 240px; padding: 5px 9px; left: 0; top: 0;
  border-radius: var(--v-radius-sm); background: var(--v-glass-solid); color: var(--v-text);
  border: 1px solid var(--v-line); box-shadow: var(--v-shadow); font: 500 12px/1.35 var(--v-font);
  pointer-events: none; opacity: 0; transition: opacity 0.12s; }
.void-tooltip[data-shown] { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .void-tooltip { transition: none; } }
`;

/** The text for the nearest element under the pointer that has one. */
function tipFor(start: Element | null): { host: HTMLElement; text: string } | undefined {
  for (let el = start; el; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue;
    // The native title would show a second, unstyled bubble, so keep its text in data-tip. Code
    // that sets `title` again later is picked up on the next hover.
    if (el.title) {
      el.dataset.tip = el.title;
      el.removeAttribute("title");
    }
    let text = el.dataset.tip;
    // An icon-only button is named by its aria-label, which is the right thing to say aloud too.
    if (!text && el instanceof HTMLButtonElement && !el.textContent?.trim()) {
      text = el.getAttribute("aria-label") ?? undefined;
    }
    if (text) return { host: el, text };
  }
  return undefined;
}

/**
 * Styled hover (and keyboard focus) tooltips for every control. Buttons keep using `title`; this
 * swaps the slow native bubble for one that matches the theme. Call once.
 */
export function installTooltips() {
  if (document.querySelector(".void-tooltip")) return;
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  const bubble = document.createElement("div");
  bubble.className = "void-tooltip";
  bubble.setAttribute("role", "tooltip");
  document.body.append(bubble);

  let host: HTMLElement | undefined;
  let timer: number | undefined;

  const hide = () => {
    window.clearTimeout(timer);
    host = undefined;
    bubble.removeAttribute("data-shown");
  };

  const place = (target: HTMLElement) => {
    const anchor = target.getBoundingClientRect();
    const own = bubble.getBoundingClientRect();
    const x = anchor.left + anchor.width / 2 - own.width / 2;
    // Above by default; below when there is no room (the bars sit along the top edge).
    const above = anchor.top - own.height - GAP >= EDGE;
    const y = above ? anchor.top - own.height - GAP : anchor.bottom + GAP;
    bubble.style.translate = `${Math.round(
      Math.min(Math.max(EDGE, x), window.innerWidth - own.width - EDGE),
    )}px ${Math.round(Math.min(y, window.innerHeight - own.height - EDGE))}px`;
  };

  const show = (target: HTMLElement, text: string) => {
    host = target;
    bubble.textContent = text;
    place(target);
    bubble.setAttribute("data-shown", "");
  };

  const consider = (event: Event, delay: number) => {
    const found = tipFor(event.target instanceof Element ? event.target : null);
    if (!found) return hide();
    if (found.host === host) return;
    hide();
    timer = window.setTimeout(() => {
      // The control may have gone or changed its mind while we waited.
      if (found.host.isConnected) show(found.host, found.host.dataset.tip ?? found.text);
    }, delay);
  };

  document.addEventListener("pointerover", (e) => {
    // Touch has no hover; a tooltip would only stick after a tap.
    if ((e as PointerEvent).pointerType === "touch") return;
    consider(e, DELAY_MS);
  });
  document.addEventListener("pointerout", (e) => {
    if (!e.relatedTarget) hide();
  });
  document.addEventListener("focusin", (e) => {
    // Only for keyboard focus; a mouse click focuses too and would flash the tip.
    if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) consider(e, 0);
  });
  document.addEventListener("focusout", hide);
  document.addEventListener("pointerdown", hide, true);
  document.addEventListener("keydown", hide, true);
  window.addEventListener("blur", hide);
  window.addEventListener("resize", hide);
}
