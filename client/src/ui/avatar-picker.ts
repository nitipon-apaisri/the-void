// systems
import { FRAME } from "../systems/character-frames";

// utils
import { injectStyle } from "../utils/dom";
import { characterUrls } from "../utils/game-art";

export interface AvatarPicker {
  element: HTMLElement;
  value(): number;
}

const STYLE_ID = "void-avatar-style";
const STYLES = `
.void-avatars { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; justify-items: center; }
.void-avatar { width: 40px; height: 68px; padding: 0; border-radius: 8px; cursor: pointer;
  border: 2px solid transparent; background-color: #0b0b10; background-repeat: no-repeat;
  image-rendering: pixelated; }
.void-avatar[aria-checked="true"] { border-color: #6ee7b7; }
.void-avatar:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
`;

// Idle, facing down: the second row of the sheet, fourth direction.
const PREVIEW_COLUMN = 18;
const PREVIEW_ROW = 1;

/** A row of character thumbnails; one is selected at a time. */
export function createAvatarPicker(initial: number, label: string): AvatarPicker {
  injectStyle(STYLE_ID, STYLES);
  const element = document.createElement("div");
  element.className = "void-avatars";
  element.setAttribute("role", "radiogroup");
  element.setAttribute("aria-label", label);

  let selected = Math.min(Math.max(initial, 0), characterUrls.length - 1);
  const buttons = characterUrls.map((url, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "void-avatar";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-label", `Character ${i + 1}`);
    button.style.backgroundImage = `url("${url}")`;
    // Centre the 32px frame in the 36px inner width of the button.
    button.style.backgroundPosition = `${2 - PREVIEW_COLUMN * FRAME.width}px ${2 - PREVIEW_ROW * FRAME.height}px`;
    button.addEventListener("click", () => select(i));
    element.append(button);
    return button;
  });

  function select(i: number) {
    selected = i;
    buttons.forEach((b, j) => b.setAttribute("aria-checked", String(j === i)));
  }
  select(selected);

  return { element, value: () => selected };
}
