// Meeting rooms. A zone is a rectangle on the map's "zones" layer (the walled rooms people meet
// in). The server works out who stands inside which one and puts it in the player's state; voice
// and video then follow the room instead of the distance.

export const ZONES_LAYER = "zones";

/** A private room: a rectangle in world pixels. */
export interface MapZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
