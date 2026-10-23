// lib
import { readFileSync } from "node:fs";

// shared
import {
  createGrid,
  MAP_COLS,
  MAP_ROWS,
  isSeatFacing,
  SEATS_LAYER,
  TABLES_LAYER,
  TILE_SIZE,
  type CollisionGrid,
  type MapTable,
  type Seat,
} from "@void/shared";

interface TiledLayer {
  name?: unknown;
  data?: unknown;
}

/**
 * Builds the wall grid from a Tiled map: any tile on the "collision" layer blocks. The client
 * reads the same layer, so both sides agree on where walls are. Throws on a map that does not
 * match the shared dimensions, since every position check would then be wrong.
 */
export function parseCollisionGrid(tmj: unknown): CollisionGrid {
  const map = tmj as { width?: unknown; height?: unknown; tilewidth?: unknown; layers?: unknown };
  if (map?.width !== MAP_COLS || map.height !== MAP_ROWS || map.tilewidth !== TILE_SIZE) {
    throw new Error(`map must be ${MAP_COLS}x${MAP_ROWS} tiles of ${TILE_SIZE}px`);
  }
  const layers = Array.isArray(map.layers) ? (map.layers as TiledLayer[]) : [];
  const layer = layers.find((l) => l.name === "collision");
  if (!layer || !Array.isArray(layer.data) || layer.data.length !== MAP_COLS * MAP_ROWS) {
    throw new Error("the map has no usable collision layer");
  }
  const data = layer.data as unknown[];
  return createGrid(
    MAP_COLS,
    MAP_ROWS,
    TILE_SIZE,
    (col, row) => Number(data[row * MAP_COLS + col]) > 0,
  );
}

export function loadCollisionGrid(file: string | URL): CollisionGrid {
  return parseCollisionGrid(JSON.parse(readFileSync(file, "utf8")));
}

/** The claimable desks from the map's "tables" layer. A map without one simply has none. */
export function parseTables(tmj: unknown): MapTable[] {
  const layers = (tmj as { layers?: unknown })?.layers;
  const layer = (Array.isArray(layers) ? (layers as TiledLayer[]) : []).find(
    (l) => l.name === TABLES_LAYER,
  );
  const objects = Array.isArray((layer as { objects?: unknown })?.objects)
    ? ((layer as { objects: unknown[] }).objects as Record<string, unknown>[])
    : [];
  const tables: MapTable[] = [];
  for (const o of objects) {
    const { id, name, x, y, width, height } = o;
    if (typeof id !== "number" || !Number.isInteger(id)) continue;
    if (![x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    tables.push({
      id: String(id),
      name: typeof name === "string" && name ? name : `Desk ${id}`,
      x: x as number,
      y: y as number,
      width: width as number,
      height: height as number,
    });
  }
  return tables;
}

export function loadTables(file: string | URL): MapTable[] {
  return parseTables(JSON.parse(readFileSync(file, "utf8")));
}

/** The chairs on the map's "seats" layer. Ids start with "s" so they never match a piece's "f" id. */
export function parseSeats(tmj: unknown): Seat[] {
  const layers = (tmj as { layers?: unknown })?.layers;
  const layer = (Array.isArray(layers) ? (layers as TiledLayer[]) : []).find(
    (l) => l.name === SEATS_LAYER,
  );
  const objects = Array.isArray((layer as { objects?: unknown })?.objects)
    ? ((layer as { objects: unknown[] }).objects as Record<string, unknown>[])
    : [];
  const seats: Seat[] = [];
  for (const o of objects) {
    const { id, x, y, properties } = o;
    if (typeof id !== "number" || !Number.isInteger(id)) continue;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x + y)) continue;
    const props = Array.isArray(properties)
      ? (properties as { name?: unknown; value?: unknown }[])
      : [];
    const facing = props.find((p) => p.name === "facing")?.value;
    const art = props.find((p) => p.name === "art")?.value;
    if (!isSeatFacing(facing)) continue;
    seats.push({ id: `s${id}`, x, y, facing, ...(typeof art === "string" ? { art } : {}) });
  }
  return seats;
}

export function loadSeats(file: string | URL): Seat[] {
  return parseSeats(JSON.parse(readFileSync(file, "utf8")));
}
