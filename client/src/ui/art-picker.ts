// shared
import {
  ART_CATALOG,
  MAX_CUSTOM_SIDE,
  SHEETS,
  TILE_SIZE,
  customId,
  findFurniture,
  type ArtPiece,
  type FurnitureItem,
  type SheetName,
} from "@void/shared";

// ui
import { piecePreview } from "./piece-preview";

// utils
import { tilesetUrls } from "../utils/game-art";

export interface ArtPicker {
  element: HTMLElement;
  /** Drops the highlight, e.g. when a catalogue piece was picked instead. */
  clear(): void;
}

interface Selection {
  col: number;
  row: number;
  w: number;
  h: number;
}

const ANY_TILES = "Any tiles";

/** Pieces of the art sheets, grouped like a shop, plus a free-form mode to cut any tiles. */
export function createArtPicker(onPick: (item: FurnitureItem | undefined) => void): ArtPicker {
  const element = document.createElement("div");
  element.className = "void-art";
  const sheets = (Object.keys(SHEETS) as SheetName[]).filter((name) => tilesetUrls[name]);
  if (sheets.length === 0) {
    element.textContent = "No art found. Run npm run assets:import.";
    return { element, clear() {} };
  }

  const head = document.createElement("div");
  head.className = "void-art-head";
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = "‹";
  const title = document.createElement("strong");
  head.append(back, title);
  const groups = document.createElement("div");
  groups.className = "void-decor-grid void-art-groups";
  const cards = document.createElement("div");
  cards.className = "void-decor-grid void-art-cards";
  const free = document.createElement("div");
  const sheetTabs = document.createElement("div");
  sheetTabs.className = "void-art-tabs";
  const scroller = document.createElement("div");
  scroller.className = "void-art-scroll";
  const sheetBox = document.createElement("div");
  sheetBox.className = "void-art-sheet";
  const mark = document.createElement("div");
  mark.className = "void-art-mark";
  mark.hidden = true;
  sheetBox.append(mark);
  scroller.append(sheetBox);
  free.append(sheetTabs, scroller);
  const solidLabel = document.createElement("label");
  const solid = document.createElement("input");
  solid.type = "checkbox";
  solidLabel.append(solid, " Blocks walking");
  const hint = document.createElement("p");
  element.append(head, groups, cards, free, solidLabel, hint);

  let sheet = sheets[0]!;
  // What is currently chosen, as a rectangle of `sheet` (free-form) or of the piece's own sheet.
  let chosen: (ArtPiece & { card?: HTMLButtonElement; ready?: FurnitureItem }) | undefined;
  let sel: Selection | undefined;
  let anchor: { col: number; row: number } | undefined;

  const publish = () => {
    if (!chosen) return onPick(undefined);
    if (chosen.ready) return onPick(chosen.ready);
    const { sheet: s, sx, sy, w, h } = chosen;
    onPick(findFurniture(customId(s, sx, sy, w, h, solid.checked)));
  };

  // Category view: one card per piece.
  const buildCards = (name: string) => {
    cards.replaceChildren();
    const group = ART_CATALOG.find((c) => c.name === name);
    // Ready-made pieces first (they know their seats and walls), then the cut-outs.
    const entries = [
      ...(group?.items ?? []).flatMap((id) => findFurniture(id) ?? []).map((item) => ({ item })),
      ...(group?.pieces ?? []).map((piece) => ({ piece })),
    ];
    for (const entry of entries) {
      const shape = "item" in entry ? entry.item : entry.piece;
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", "false");
      button.append(piecePreview(shape), shape.name);
      button.addEventListener("click", () => {
        for (const b of cards.children) b.setAttribute("aria-pressed", "false");
        if (chosen?.card === button) {
          chosen = undefined;
        } else {
          button.setAttribute("aria-pressed", "true");
          chosen = { ...shape, card: button, ready: "item" in entry ? entry.item : undefined };
        }
        publish();
      });
      cards.append(button);
    }
  };

  // Free-form view: drag over the raw sheet.
  const cell = (e: PointerEvent) => {
    const r = sheetBox.getBoundingClientRect();
    const size = SHEETS[sheet];
    return {
      col: Math.min(size.cols - 1, Math.max(0, Math.floor((e.clientX - r.left) / TILE_SIZE))),
      row: Math.min(size.rows - 1, Math.max(0, Math.floor((e.clientY - r.top) / TILE_SIZE))),
    };
  };
  const pickRect = () => {
    if (!sel) {
      mark.hidden = true;
      chosen = undefined;
    } else {
      mark.hidden = false;
      mark.style.cssText = `left:${sel.col * TILE_SIZE}px;top:${sel.row * TILE_SIZE}px;width:${sel.w * TILE_SIZE}px;height:${sel.h * TILE_SIZE}px;`;
      chosen = { name: "Custom piece", sheet, sx: sel.col, sy: sel.row, w: sel.w, h: sel.h };
    }
    publish();
  };
  sheetBox.addEventListener("pointerdown", (e) => {
    anchor = cell(e);
    sel = { ...anchor, w: 1, h: 1 };
    sheetBox.setPointerCapture(e.pointerId);
    pickRect();
  });
  sheetBox.addEventListener("pointermove", (e) => {
    if (!anchor) return;
    const now = cell(e);
    const w = Math.min(MAX_CUSTOM_SIDE, Math.abs(now.col - anchor.col) + 1);
    const h = Math.min(MAX_CUSTOM_SIDE, Math.abs(now.row - anchor.row) + 1);
    // The anchor stays put when dragging up or left past the size cap.
    sel = {
      col: now.col < anchor.col ? anchor.col - w + 1 : anchor.col,
      row: now.row < anchor.row ? anchor.row - h + 1 : anchor.row,
      w,
      h,
    };
    pickRect();
  });
  sheetBox.addEventListener("pointerup", () => (anchor = undefined));
  solid.addEventListener("change", publish);

  const sheetButtons = new Map<SheetName, HTMLButtonElement>();
  const showSheet = (name: SheetName) => {
    sheet = name;
    sel = undefined;
    pickRect();
    const size = SHEETS[name];
    sheetBox.style.width = `${size.cols * TILE_SIZE}px`;
    sheetBox.style.height = `${size.rows * TILE_SIZE}px`;
    sheetBox.style.backgroundImage = `url(${tilesetUrls[name]})`;
    for (const [n, b] of sheetButtons) b.setAttribute("aria-pressed", String(n === name));
    scroller.scrollTop = 0;
  };
  for (const name of sheets) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.addEventListener("click", () => showSheet(name));
    sheetButtons.set(name, b);
    sheetTabs.append(b);
  }

  const sample = { sheet: "generic", sx: 9, sy: 4, w: 4, h: 3 } as const;
  const show = (name: string | undefined) => {
    chosen = undefined;
    sel = undefined;
    mark.hidden = true;
    const isFree = name === ANY_TILES;
    groups.hidden = name !== undefined;
    head.hidden = name === undefined;
    cards.hidden = name === undefined || isFree;
    free.hidden = !isFree;
    solidLabel.hidden = name === undefined;
    title.textContent = name ?? "";
    hint.textContent =
      name === undefined
        ? ""
        : isFree
          ? "Drag over tiles to cut a piece (up to 10 x 10), then click the map."
          : "Pick a piece, then click the map.";
    if (isFree) showSheet(sheet);
    else if (name !== undefined) {
      buildCards(name);
      solid.checked = ART_CATALOG.find((c) => c.name === name)?.solid ?? true;
    }
    cards.scrollTop = 0;
    publish();
  };
  back.addEventListener("click", () => show(undefined));
  const groupCard = (name: string, count: string, shape: Parameters<typeof piecePreview>[0]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.append(piecePreview(shape), `${name} · ${count}`);
    b.addEventListener("click", () => show(name));
    groups.append(b);
  };
  for (const group of ART_CATALOG) {
    const first = findFurniture(group.items?.[0] ?? "") ?? group.pieces[0]!;
    groupCard(group.name, String((group.items?.length ?? 0) + group.pieces.length), first);
  }
  groupCard(ANY_TILES, "sheets", sample);
  show(undefined);

  return {
    element,
    clear() {
      chosen = undefined;
      sel = undefined;
      mark.hidden = true;
      show(undefined);
      for (const b of cards.children) b.setAttribute("aria-pressed", "false");
    },
  };
}
