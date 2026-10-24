// Private rooms. A zone is a rectangle: the template's walled meeting rooms (the map's "zones"
// layer) and the ones owners and admins draw (stored per space). The server works out who stands
// inside which one and puts it in the player's state; voice and video then follow the room
// instead of the distance.

import type { SpaceRole } from "./index.js";

export const ZONES_LAYER = "zones";

/** A private room: a rectangle in world pixels. */
export interface MapZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Drawn by an owner or admin (and removable), as opposed to part of the template. */
  custom?: boolean;
}

/** The id of the zone a point is in, or "" outside all of them. */
export function zoneAt(zones: readonly MapZone[], pos: { x: number; y: number }): string {
  for (const z of zones) {
    if (pos.x >= z.x && pos.x < z.x + z.width && pos.y >= z.y && pos.y < z.y + z.height) {
      return z.id;
    }
  }
  return "";
}

const TILE = 32;
export const MAX_CUSTOM_ZONES = 20;
export const MIN_ZONE_TILES = 3;
export const MAX_ZONE_TILES = 40;

/** A new room, in tiles: its top left tile and its size. */
export interface AddZonePayload {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface RemoveZonePayload {
  id: string;
}

export const canManageZones = (role: SpaceRole) => role === "owner" || role === "admin";

/** Why a room cannot go here, or undefined when it can. `mapCols`/`mapRows` are in tiles. */
export function zoneError(
  rect: AddZonePayload,
  zones: readonly MapZone[],
  mapCols: number,
  mapRows: number,
): string | undefined {
  const { col, row, cols, rows } = rect;
  if (![col, row, cols, rows].every(Number.isInteger)) return "invalid room";
  if (cols < MIN_ZONE_TILES || rows < MIN_ZONE_TILES) {
    return `a room is at least ${MIN_ZONE_TILES} x ${MIN_ZONE_TILES} tiles`;
  }
  if (cols > MAX_ZONE_TILES || rows > MAX_ZONE_TILES) {
    return `a room is at most ${MAX_ZONE_TILES} x ${MAX_ZONE_TILES} tiles`;
  }
  if (col < 0 || row < 0 || col + cols > mapCols || row + rows > mapRows) {
    return "the room must be inside the map";
  }
  const overlaps = zones.some(
    (z) =>
      col * TILE < z.x + z.width &&
      (col + cols) * TILE > z.x &&
      row * TILE < z.y + z.height &&
      (row + rows) * TILE > z.y,
  );
  return overlaps ? "that overlaps another room" : undefined;
}
