// shared
import { AVATAR_COLORS, MAX_NAME_LENGTH, type JoinOptions } from "@void/shared";

// utils
import { injectStyle } from "../utils/dom";
import { loadJson, saveJson } from "../utils/storage";

export type Profile = Required<JoinOptions>;

const STORAGE_KEY = "void.profile";
const STYLE_ID = "void-join-style";
const STYLES = `
.void-join { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center;
  background: rgb(11 11 16 / 0.85); font: 14px/1.4 system-ui, sans-serif; color: #f9fafb; }
.void-join form { width: min(360px, calc(100vw - 32px)); padding: 24px; border-radius: 12px;
  background: #111827; border: 1px solid #374151; display: grid; gap: 16px; }
.void-join h1 { margin: 0; font-size: 18px; }
.void-join label { display: grid; gap: 6px; color: #9ca3af; }
.void-join input { padding: 10px 12px; border-radius: 8px; border: 1px solid #374151;
  background: #0b0b10; color: #f9fafb; font: inherit; }
.void-join input:focus-visible, .void-join button:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
.void-join .swatches { display: flex; gap: 10px; flex-wrap: wrap; }
.void-join .swatch { width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.void-join .swatch[aria-checked="true"] { border-color: #f9fafb; }
.void-join .submit { padding: 10px 12px; border-radius: 8px; border: 0; cursor: pointer;
  background: #6ee7b7; color: #052e1f; font: inherit; font-weight: 600; }
`;

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Asks for a name and avatar, then resolves with the choice. */
export function promptProfile(): Promise<Profile> {
  injectStyle(STYLE_ID, STYLES);
  const saved = loadJson<Partial<Profile>>(STORAGE_KEY);
  let avatar =
    Number.isInteger(saved?.avatar) && saved!.avatar! >= 0 && saved!.avatar! < AVATAR_COLORS.length
      ? saved!.avatar!
      : 0;

  const overlay = document.createElement("div");
  overlay.className = "void-join";
  overlay.innerHTML = `
    <form role="dialog" aria-modal="true" aria-labelledby="void-join-title">
      <h1 id="void-join-title">Join The Void</h1>
      <label>Name
        <input name="name" maxlength="${MAX_NAME_LENGTH}" required autocomplete="nickname" />
      </label>
      <div role="radiogroup" aria-label="Avatar colour" class="swatches"></div>
      <button class="submit" type="submit">Enter</button>
    </form>`;

  const form = overlay.querySelector("form")!;
  const input = overlay.querySelector<HTMLInputElement>("input[name=name]")!;
  const group = overlay.querySelector(".swatches")!;
  input.value = typeof saved?.name === "string" ? saved.name.slice(0, MAX_NAME_LENGTH) : "";

  const swatches = AVATAR_COLORS.map((color, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.background = hex(color);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", `Colour ${i + 1}`);
    b.addEventListener("click", () => select(i));
    group.append(b);
    return b;
  });
  const select = (i: number) => {
    avatar = i;
    swatches.forEach((b, j) => b.setAttribute("aria-checked", String(j === i)));
  };
  select(avatar);

  document.body.append(overlay);
  input.focus();

  return new Promise((resolve) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const profile = { name: input.value.trim() || "guest", avatar };
      saveJson(STORAGE_KEY, profile);
      overlay.remove();
      resolve(profile);
    });
  });
}
