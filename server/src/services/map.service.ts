// lib
import { readFileSync } from "node:fs";

// shared
import { createGrid, MAP_COLS, MAP_ROWS, TILE_SIZE, type CollisionGrid } from "@void/shared";

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
