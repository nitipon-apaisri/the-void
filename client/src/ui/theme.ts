// utils
import { injectStyle } from "../utils/dom";

const STYLE_ID = "void-theme";

// Dark glass: translucent panels over the world, one soft accent, small radii.
// Every ui module reads these variables, so the look changes in one place.
const STYLES = `
:root {
  --v-font: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --v-text: #f4f5fb;
  --v-muted: #a3a8c3;
  --v-bg: #0d0e17;
  --v-glass: rgb(24 26 42 / 0.8);
  --v-glass-solid: #181a2a;
  --v-field: rgb(255 255 255 / 0.06);
  --v-hover: rgb(255 255 255 / 0.1);
  --v-line: rgb(255 255 255 / 0.1);
  --v-accent: #8b93ff;
  --v-accent-ink: #0c0e24;
  --v-on: #5eead4;
  --v-danger: #ff6b81;
  --v-danger-bg: rgb(255 107 129 / 0.16);
  --v-chip: rgb(13 14 23 / 0.72);
  --v-radius: 16px;
  --v-radius-sm: 8px;
  --v-radius-xs: 4px;
  /* A button inside a padded floating bar: the bar's radius minus its padding, so the corners nest. */
  --v-radius-in: calc(var(--v-radius) - 6px);
  --v-shadow: 0 4px 16px rgb(3 4 12 / 0.35);
  --v-blur: blur(12px) saturate(1.2);
}
.v-glass { background: var(--v-glass); border: 1px solid var(--v-line); box-shadow: var(--v-shadow);
  -webkit-backdrop-filter: var(--v-blur); backdrop-filter: var(--v-blur); }
.v-scrim { background: rgb(8 9 16 / 0.6); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }

/* Motion. Panels and dialogs ease in whenever they are shown (a [hidden] element restarts its
   animation when it appears). The individual translate and scale properties are used so they
   never fight the transform some panels use to centre themselves. */
@keyframes v-pop { from { opacity: 0; translate: 0 10px; scale: 0.97; } }
@keyframes v-fade { from { opacity: 0; } }
.v-glass:not(.void-toast) { animation: v-pop 0.2s cubic-bezier(0.2, 0.8, 0.2, 1); }
.v-scrim { animation: v-fade 0.18s ease-out; }
:where(button, select, input, textarea, summary) {
  transition: background-color 0.16s, border-color 0.16s, color 0.16s, box-shadow 0.16s, filter 0.16s,
    scale 0.12s, opacity 0.16s;
}
:where(button:not(:disabled)):hover { filter: brightness(1.12); }
:where(button:not(:disabled)):active { scale: 0.96; filter: brightness(0.95); }
:where(button:disabled) { opacity: 0.5; }
@media (prefers-reduced-motion: reduce) {
  .v-glass, .v-scrim { animation: none !important; }
  :where(button, select, input, textarea, summary) { transition: none; }
  :where(button:not(:disabled)):active { scale: 1; }
}
`;

/** Injects the shared design tokens once. Call before a ui module adds its own styles. */
export function applyTheme() {
  injectStyle(STYLE_ID, STYLES);
}
