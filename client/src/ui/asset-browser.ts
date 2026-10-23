// shared
import { TILE_SIZE } from "@void/shared";

// utils
import { tilesetUrls, hasGameArt } from "../utils/game-art";
import { injectStyle } from "../utils/dom";

const STYLE_ID = "void-assets-style";
const STYLES = `
.ab { font: 13px/1.4 system-ui, sans-serif; color: #e8e9f3; padding: 16px; }
.ab h1 { margin: 0 0 4px; font-size: 16px; }
.ab p { margin: 0 0 12px; color: #9aa0b8; }
.ab-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.ab-bar button { padding: 6px 12px; border: 1px solid #2c2f45; border-radius: 8px; background: #171826; color: inherit; cursor: pointer; }
.ab-bar button[aria-pressed="true"] { border-color: #8b93ff; background: #25274a; }
.ab-bar label { color: #9aa0b8; }
.ab-info { min-height: 20px; font-family: ui-monospace, monospace; }
.ab-info button { margin-left: 8px; padding: 2px 8px; }
.ab-wrap { position: relative; display: inline-block; background: #2a2c40; }
.ab-wrap canvas { display: block; image-rendering: pixelated; cursor: crosshair; }
`;

/** A browser for the tile sheets: pick a piece by eye and read off its sheet, column, row and size. */
export function mountAssetBrowser(root: HTMLElement) {
  injectStyle(STYLE_ID, STYLES);
  const box = document.createElement("div");
  box.className = "ab";
  root.append(box);
  box.innerHTML = "<h1>Asset browser</h1>";

  if (!hasGameArt) {
    box.insertAdjacentHTML(
      "beforeend",
      "<p>No art yet. Run <code>npm run assets:import</code>.</p>",
    );
    return;
  }
  box.insertAdjacentHTML(
    "beforeend",
    "<p>Pick a sheet, then click a tile or drag over several. The box below gives the values for <code>FURNITURE</code> in <code>shared/src/furniture.ts</code>.</p>",
  );

  const bar = document.createElement("div");
  bar.className = "ab-bar";
  const info = document.createElement("div");
  info.className = "ab-info";
  const wrap = document.createElement("div");
  wrap.className = "ab-wrap";
  const canvas = document.createElement("canvas");
  wrap.append(canvas);
  box.append(bar, info, wrap);
  const ctx = canvas.getContext("2d")!;

  let name = Object.keys(tilesetUrls)[0]!;
  let scale = 2;
  let image: HTMLImageElement | undefined;
  let anchor: { col: number; row: number } | undefined;
  let sel: { col: number; row: number; w: number; h: number } | undefined;
  let hover: { col: number; row: number } | undefined;
  const px = TILE_SIZE;

  const draw = () => {
    if (!image) return;
    const t = px * scale;
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgb(255 255 255 / 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += t) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += t) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(canvas.width, y + 0.5);
    }
    ctx.stroke();
    ctx.fillStyle = "rgb(255 255 255 / 0.55)";
    ctx.font = "10px monospace";
    // Row numbers down the left edge and column numbers across the top, every few tiles.
    for (let r = 0; r < image.height / px; r += 1) ctx.fillText(String(r), 2, r * t + 10);
    for (let c = 1; c < image.width / px; c += 1) ctx.fillText(String(c), c * t + 2, 10);
    const box = (b: { col: number; row: number; w: number; h: number }, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.col * t + 1, b.row * t + 1, b.w * t - 2, b.h * t - 2);
    };
    if (hover) box({ ...hover, w: 1, h: 1 }, "#ffd166");
    if (sel) box(sel, "#8b93ff");
  };

  const describe = () => {
    info.textContent = "";
    const where = sel ?? (hover ? { ...hover, w: 1, h: 1 } : undefined);
    if (!where) return (info.textContent = `${name}: hover a tile`);
    const text = `sheet: "${name}", sx: ${where.col}, sy: ${where.row}, w: ${where.w}, h: ${where.h}`;
    info.append(text);
    const copy = document.createElement("button");
    copy.textContent = "Copy";
    copy.addEventListener("click", () => void navigator.clipboard?.writeText(text));
    info.append(copy);
  };

  const cell = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const t = px * scale;
    return {
      col: Math.max(0, Math.floor((e.clientX - r.left) / t)),
      row: Math.max(0, Math.floor((e.clientY - r.top) / t)),
    };
  };
  canvas.addEventListener("pointerdown", (e) => {
    anchor = cell(e);
    sel = { ...anchor, w: 1, h: 1 };
    draw();
    describe();
  });
  canvas.addEventListener("pointermove", (e) => {
    hover = cell(e);
    if (anchor && e.buttons) {
      sel = {
        col: Math.min(anchor.col, hover.col),
        row: Math.min(anchor.row, hover.row),
        w: Math.abs(hover.col - anchor.col) + 1,
        h: Math.abs(hover.row - anchor.row) + 1,
      };
    }
    draw();
    describe();
  });
  canvas.addEventListener("pointerup", () => (anchor = undefined));
  canvas.addEventListener("pointerleave", () => {
    hover = undefined;
    draw();
    describe();
  });

  const buttons = new Map<string, HTMLButtonElement>();
  const load = (next: string) => {
    name = next;
    sel = hover = undefined;
    for (const [n, b] of buttons) b.setAttribute("aria-pressed", String(n === next));
    const img = new Image();
    img.onload = () => {
      image = img;
      draw();
      describe();
    };
    img.src = tilesetUrls[next]!;
  };
  for (const n of Object.keys(tilesetUrls)) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = n;
    b.addEventListener("click", () => load(n));
    buttons.set(n, b);
    bar.append(b);
  }
  const zoom = document.createElement("label");
  zoom.textContent = "Zoom ";
  const range = document.createElement("input");
  range.type = "range";
  range.min = "1";
  range.max = "4";
  range.value = String(scale);
  range.addEventListener("input", () => {
    scale = Number(range.value);
    draw();
  });
  zoom.append(range);
  bar.append(zoom);
  load(name);
}
