// shared
import { LOOK_PARTS, type Look, type LookPart } from "@void/shared";

// systems
import { FRAME } from "../systems/character-frames";
import {
  groupStyles,
  locate,
  randomLook,
  stepColour,
  stepStyle,
  type StyleGroup,
} from "../systems/look-groups";

// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";
import { lookManifest } from "../utils/look-art";
import { drawLayers, loadLookImages } from "../utils/look-render";

export interface LookEditor {
  element: HTMLElement;
  value(): Look;
}

const STYLE_ID = "void-look-style";
const STYLES = `
.void-look { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; }
.void-look__preview { display: grid; justify-items: center; gap: 8px; }
.void-look canvas { width: 96px; height: 192px; image-rendering: pixelated; border-radius: var(--v-radius);
  background: var(--v-field); border: 1px solid var(--v-line); }
.void-look__parts { display: grid; gap: 8px; }
.void-look__part { display: grid; grid-template-columns: 64px 1fr; align-items: center; gap: 8px; color: var(--v-muted); }
.void-look__pickers { display: grid; gap: 4px; }
.void-look__picker { display: grid; grid-template-columns: 28px 1fr 28px; align-items: center; gap: 4px;
  font-size: 12px; color: var(--v-text); text-align: center; }
.void-look__picker span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.void-look .void-look__btn { display: grid; place-items: center; width: 28px; height: 28px; padding: 0;
  border-radius: var(--v-radius-sm); border: 0; background: var(--v-field); color: var(--v-text); cursor: pointer; font-size: 16px; line-height: 1; }
.void-look .void-look__btn:hover { background: var(--v-hover); }
.void-look .void-look__btn:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 1px; }
.void-look .void-look__shuffle { width: auto; height: auto; padding: 6px 14px; border-radius: var(--v-radius-sm); font-size: 13px; }
`;

const LABELS: Record<LookPart, string> = {
  body: "Skin",
  eyes: "Eyes",
  outfit: "Outfit",
  hair: "Hair",
  accessory: "Extra",
};

// Idle, facing down: the second row of the sheet, fourth direction.
const PREVIEW = { x: 18 * FRAME.width, y: FRAME.height, width: FRAME.width, height: FRAME.height };

/** A preview of the character with a style and colour stepper for each layered part. */
export function createLookEditor(initial: Look): LookEditor {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  let look = { ...initial };
  const groups = Object.fromEntries(
    LOOK_PARTS.map((part) => [part, groupStyles(lookManifest[part])]),
  ) as Record<LookPart, StyleGroup[]>;

  const element = document.createElement("div");
  element.className = "void-look";

  const preview = document.createElement("div");
  preview.className = "void-look__preview";
  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW.width;
  canvas.height = PREVIEW.height;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Your character");
  const shuffle = document.createElement("button");
  shuffle.type = "button";
  shuffle.className = "void-look__btn void-look__shuffle";
  shuffle.textContent = "Shuffle";
  preview.append(canvas, shuffle);

  const parts = document.createElement("div");
  parts.className = "void-look__parts";
  element.append(preview, parts);

  const makeStepper = (label: string, onStep: (delta: number) => void) => {
    const row = document.createElement("div");
    row.className = "void-look__picker";
    const text = document.createElement("span");
    const button = (glyph: string, delta: number, aria: string) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "void-look__btn";
      b.textContent = glyph;
      b.setAttribute("aria-label", aria);
      b.addEventListener("click", () => onStep(delta));
      return b;
    };
    row.append(button("‹", -1, `Previous ${label}`), text, button("›", 1, `Next ${label}`));
    return { row, text };
  };

  const updaters: Array<() => void> = [];
  for (const part of LOOK_PARTS) {
    const wrap = document.createElement("div");
    wrap.className = "void-look__part";
    const name = document.createElement("span");
    name.textContent = LABELS[part];
    const pickers = document.createElement("div");
    pickers.className = "void-look__pickers";

    const optional = part === "accessory";
    const set = (index: number) => {
      look = { ...look, [part]: index };
      refresh();
    };
    const style = makeStepper(`${LABELS[part]} style`, (d) =>
      set(stepStyle(groups[part], look[part], d, optional)),
    );
    const colour = makeStepper(`${LABELS[part]} colour`, (d) =>
      set(stepColour(groups[part], look[part], d)),
    );
    // Skin and eyes only come in colours, so one stepper is enough.
    const single = groups[part].length === 1;
    pickers.append(...(single ? [colour.row] : [style.row, colour.row]));
    wrap.append(name, pickers);
    parts.append(wrap);

    updaters.push(() => {
      const found = locate(groups[part], look[part]);
      if (!found) {
        style.text.textContent = "None";
        colour.text.textContent = "–";
        colour.row.hidden = true;
        return;
      }
      const group = groups[part][found.group]!;
      colour.row.hidden = false;
      style.text.textContent = group.name || `Style ${found.group + 1} of ${groups[part].length}`;
      colour.text.textContent = `Colour ${found.colour + 1} of ${group.indices.length}`;
    });
  }

  let drawId = 0;
  function refresh() {
    for (const update of updaters) update();
    const id = ++drawId;
    void loadLookImages(look).then(
      (layers) => {
        // Clicking fast can finish out of order; only the newest look is drawn.
        if (id !== drawId) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawLayers(ctx, layers, PREVIEW);
      },
      (err) => console.warn("character preview failed", err),
    );
  }

  shuffle.addEventListener("click", () => {
    look = randomLook();
    refresh();
  });

  refresh();
  return { element, value: () => ({ ...look }) };
}
