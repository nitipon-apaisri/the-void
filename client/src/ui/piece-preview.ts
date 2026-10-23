// shared
import { TILE_SIZE, type FurnitureItem } from "@void/shared";

// utils
import { tilesetUrls } from "../utils/game-art";

/** A square thumbnail of a piece, cut from its sheet. Styled by `.void-decor-preview` in the panel. */
export function piecePreview(
  item: Pick<FurnitureItem, "sheet" | "sx" | "sy" | "w" | "h">,
  size = 56,
) {
  const box = document.createElement("div");
  box.className = "void-decor-preview";
  box.style.width = box.style.height = `${size}px`;
  const inner = document.createElement("div");
  const width = item.w * TILE_SIZE;
  const height = item.h * TILE_SIZE;
  const scale = Math.min(1, size / Math.max(width, height));
  const url = tilesetUrls[item.sheet];
  inner.style.cssText =
    `width:${width}px;height:${height}px;` +
    (url ? `background-image:url(${url});` : "") +
    `background-position:${-item.sx * TILE_SIZE}px ${-item.sy * TILE_SIZE}px;` +
    `transform:translate(-50%,-50%) scale(${scale});`;
  box.append(inner);
  return box;
}
