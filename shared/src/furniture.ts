import type { SpaceRole } from "./index.js";
import type { SeatFacing } from "./seat.js";

// Decoration. Owners and admins place furniture from this catalogue on a tile grid; the room
// keeps the placed pieces (saved per space) and refuses a spot that is a wall, another piece,
// a desk's box or someone's feet. Items are pieces of the sheets the map already uses.

// Same as TILE_SIZE in index.ts (not imported, to keep this file free of a circular import).
const TILE = 32;
// Stops one space from growing without limit (state, database and every client's drawing).
export const MAX_FURNITURE = 300;

export interface TileRect {
  col: number;
  row: number;
  w: number;
  h: number;
}

export interface FurnitureItem {
  id: string;
  name: string;
  /** The tileset image (and texture) the picture comes from. */
  sheet: "generic" | "conference";
  /** Top-left tile of the picture in the sheet, and its size in tiles. */
  sx: number;
  sy: number;
  w: number;
  h: number;
  /** The tiles that block movement, relative to the top-left. Absent: you can walk over it. */
  block?: { x: number; y: number; w: number; h: number };
  /** Where you sit, in pixels from the top-left, and which way you face. Absent: not a seat. */
  seat?: { x: number; y: number; facing: SeatFacing };
  /** The top this many rows are drawn over players, so you can walk behind tall things. */
  over?: number;
}

export const FURNITURE: readonly FurnitureItem[] = [
  {
    id: "plant",
    name: "Plant",
    sheet: "conference",
    sx: 13,
    sy: 7,
    w: 1,
    h: 1,
    block: { x: 0, y: 0, w: 1, h: 1 },
  },
  {
    id: "chair",
    name: "Chair",
    sheet: "conference",
    sx: 11,
    sy: 6,
    w: 1,
    h: 1,
    block: { x: 0, y: 0, w: 1, h: 1 },
    seat: { x: 16, y: 20, facing: "down" },
  },
  {
    id: "desk",
    name: "Desk",
    sheet: "generic",
    sx: 0,
    sy: 5,
    w: 4,
    h: 3,
    block: { x: 1, y: 0, w: 2, h: 3 },
  },
  {
    id: "desk-chair",
    name: "Desk chair",
    sheet: "generic",
    sx: 2,
    sy: 11,
    w: 1,
    h: 2,
    block: { x: 0, y: 0, w: 1, h: 1 },
    seat: { x: 16, y: 24, facing: "up" },
  },
  { id: "rug", name: "Rug", sheet: "generic", sx: 9, sy: 4, w: 4, h: 3 },
  {
    id: "coffee-table",
    name: "Coffee table",
    sheet: "generic",
    sx: 6,
    sy: 11,
    w: 3,
    h: 2,
    block: { x: 0, y: 0, w: 3, h: 1 },
  },
  {
    id: "bookshelf",
    name: "Bookshelf",
    sheet: "generic",
    sx: 6,
    sy: 0,
    w: 1,
    h: 3,
    block: { x: 0, y: 2, w: 1, h: 1 },
    over: 2,
  },
  {
    id: "sideboard",
    name: "Sideboard",
    sheet: "generic",
    sx: 0,
    sy: 11,
    w: 2,
    h: 2,
    block: { x: 0, y: 1, w: 2, h: 1 },
    over: 1,
  },
  {
    id: "whiteboard",
    name: "Whiteboard",
    sheet: "conference",
    sx: 10,
    sy: 1,
    w: 2,
    h: 2,
    block: { x: 0, y: 0, w: 2, h: 2 },
  },
  {
    id: "meeting-table",
    name: "Meeting table",
    sheet: "conference",
    sx: 0,
    sy: 1,
    w: 5,
    h: 3,
    block: { x: 1, y: 0, w: 3, h: 3 },
  },
];

export const findFurniture = (id: string): FurnitureItem | undefined =>
  FURNITURE.find((item) => item.id === id);

/** A piece in the space: which item, and the tile of its top-left corner. */
export interface PlacedFurniture {
  id: string;
  itemId: string;
  col: number;
  row: number;
}

export interface PlaceFurniturePayload {
  itemId: string;
  col: number;
  row: number;
}

export interface RemoveFurniturePayload {
  id: string;
}

/** Owners and admins decorate. */
export const canDecorate = (role: SpaceRole) => role === "owner" || role === "admin";

/** The whole picture of an item placed at (col, row). */
export const fullRect = (item: FurnitureItem, col: number, row: number): TileRect => ({
  col,
  row,
  w: item.w,
  h: item.h,
});

/** The tiles an item blocks when placed at (col, row), or undefined if it blocks none. */
export const blockRect = (item: FurnitureItem, col: number, row: number): TileRect | undefined =>
  item.block && {
    col: col + item.block.x,
    row: row + item.block.y,
    w: item.block.w,
    h: item.block.h,
  };

export interface GridLike {
  cols: number;
  rows: number;
  blocked: boolean[];
}

/** Marks or clears the tiles an item blocks. Placement never overlaps blocked tiles, so clearing is safe. */
export function setBlocked(
  grid: GridLike,
  item: FurnitureItem,
  col: number,
  row: number,
  on: boolean,
) {
  const rect = blockRect(item, col, row);
  if (!rect) return;
  for (let r = rect.row; r < rect.row + rect.h; r++) {
    for (let c = rect.col; c < rect.col + rect.w; c++) {
      if (c >= 0 && r >= 0 && c < grid.cols && r < grid.rows) grid.blocked[r * grid.cols + c] = on;
    }
  }
}

const overlaps = (a: TileRect, b: { x: number; y: number; width: number; height: number }) =>
  a.col * TILE < b.x + b.width &&
  (a.col + a.w) * TILE > b.x &&
  a.row * TILE < b.y + b.height &&
  (a.row + a.h) * TILE > b.y;

/** Why an item cannot go at (col, row), or undefined if it can. `grid` already holds placed pieces. */
export function placementError(
  grid: GridLike,
  item: FurnitureItem,
  col: number,
  row: number,
  context: {
    /** Where people stand and how big their circle is. */
    people: readonly { x: number; y: number }[];
    personRadius: number;
    /** Desk boxes (the claim area), which must stay walkable. */
    tables: readonly { x: number; y: number; width: number; height: number }[];
  },
): string | undefined {
  if (!Number.isInteger(col) || !Number.isInteger(row)) return "invalid spot";
  if (col < 0 || row < 0 || col + item.w > grid.cols || row + item.h > grid.rows) {
    return "that is outside the map";
  }
  const block = blockRect(item, col, row);
  if (!block) return undefined;
  for (let r = block.row; r < block.row + block.h; r++) {
    for (let c = block.col; c < block.col + block.w; c++) {
      if (grid.blocked[r * grid.cols + c]) return "something is in the way";
    }
  }
  if (context.tables.some((t) => overlaps(block, t))) return "keep the desks clear";
  const r = context.personRadius;
  for (const p of context.people) {
    const nearestX = Math.max(block.col * TILE, Math.min(p.x, (block.col + block.w) * TILE));
    const nearestY = Math.max(block.row * TILE, Math.min(p.y, (block.row + block.h) * TILE));
    if ((p.x - nearestX) ** 2 + (p.y - nearestY) ** 2 < r * r) return "someone is standing there";
  }
  return undefined;
}
