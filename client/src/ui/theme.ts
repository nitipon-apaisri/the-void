// utils
import { injectStyle } from "../utils/dom";

const STYLE_ID = "void-theme";

// Dark glass: translucent panels over the world, one soft accent, generous radii.
// Every ui module reads these variables, so the look changes in one place.
const STYLES = `
:root {
  --v-font: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --v-text: #f4f5fb;
  --v-muted: #a3a8c3;
  --v-bg: #0d0e17;
  --v-glass: rgb(24 26 42 / 0.72);
  --v-glass-solid: #181a2a;
  --v-field: rgb(255 255 255 / 0.06);
  --v-hover: rgb(255 255 255 / 0.1);
  --v-line: rgb(255 255 255 / 0.1);
  --v-accent: #8b93ff;
  --v-accent-ink: #0c0e24;
  --v-on: #5eead4;
  --v-danger: #ff6b81;
  --v-danger-bg: rgb(255 107 129 / 0.16);
  --v-radius: 16px;
  --v-radius-sm: 10px;
  --v-shadow: 0 10px 40px rgb(3 4 12 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.07);
  --v-blur: blur(18px) saturate(1.4);
}
.v-glass { background: var(--v-glass); border: 1px solid var(--v-line); box-shadow: var(--v-shadow);
  -webkit-backdrop-filter: var(--v-blur); backdrop-filter: var(--v-blur); }
.v-scrim { background: rgb(8 9 16 / 0.6); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
`;

/** Injects the shared design tokens once. Call before a ui module adds its own styles. */
export function applyTheme() {
  injectStyle(STYLE_ID, STYLES);
}
