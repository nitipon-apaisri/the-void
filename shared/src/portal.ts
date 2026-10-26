// Cross space. Two spaces can be linked when both owners agree; a portal on the map of one leads
// into the other. Everyone who belongs to a space may cross its portals, and arrives as a guest:
// not a member, and unable to cross again from there.

import type { SpaceRole, SpaceSize, SpaceTemplate } from "./index.js";

const TILE = 32;
/** A portal covers this many tiles on each side. */
export const PORTAL_TILES = 2;
/** How far outside a portal's edge a player may stand and still cross, in pixels. */
export const PORTAL_REACH = 16;
// Stops one space from covering its map with doors.
export const MAX_PORTALS = 20;
// Stops one owner from collecting links without limit.
export const MAX_LINKS = 20;

/** Only an owner asks for, accepts or ends a link: it opens the space to other people's members. */
export const canManageLinks = (role: SpaceRole) => role === "owner";
export const canManagePortals = (role: SpaceRole) => role === "owner" || role === "admin";

export type LinkStatus = "pending" | "approved";

/** A link as one side sees it. `outgoing` means this side asked and the other owner decides. */
export interface SpaceLink {
  id: string;
  status: LinkStatus;
  direction: "incoming" | "outgoing";
  /** The space on the other end. */
  space: { id: string; name: string };
}

/** The owner shows this once; the other owner types it to ask for a link. */
export interface ConnectCode {
  code: string;
}

export interface RequestLinkPayload {
  code: string;
}

/** A portal as the room shows it: where it stands and which space it leads to. */
export interface MapPortal {
  id: string;
  /** Top-left tile. */
  col: number;
  row: number;
  targetId: string;
  targetName: string;
  /** Still on the map, but nobody can cross through it. */
  closed: boolean;
}

export interface PlacePortalPayload {
  targetId: string;
  col: number;
  row: number;
}

export interface RemovePortalPayload {
  id: string;
}

export interface SetPortalClosedPayload {
  id: string;
  closed: boolean;
}

export interface CrossPayload {
  id: string;
}

/** Where to go after the room allowed the crossing. */
export interface CrossResult {
  spaceId: string;
  name: string;
  /** The visitor is not a member, so the client cannot read these from its own space list. */
  template: SpaceTemplate;
  size: SpaceSize;
}

/** The portal rectangle in world pixels, grown by the reach. */
export function portalReachRect(portal: Pick<MapPortal, "col" | "row">) {
  const size = PORTAL_TILES * TILE;
  return {
    x: portal.col * TILE - PORTAL_REACH,
    y: portal.row * TILE - PORTAL_REACH,
    width: size + PORTAL_REACH * 2,
    height: size + PORTAL_REACH * 2,
  };
}

/** Whether a player standing at `pos` (pixels) is close enough to cross. */
export function atPortal(portal: Pick<MapPortal, "col" | "row">, pos: { x: number; y: number }) {
  const r = portalReachRect(portal);
  return pos.x >= r.x && pos.x < r.x + r.width && pos.y >= r.y && pos.y < r.y + r.height;
}

/** Why a portal cannot go here, or undefined when it can. `mapCols`/`mapRows` are in tiles. */
export function portalError(
  portal: Pick<MapPortal, "col" | "row">,
  others: readonly Pick<MapPortal, "col" | "row">[],
  mapCols: number,
  mapRows: number,
): string | undefined {
  const { col, row } = portal;
  if (!Number.isInteger(col) || !Number.isInteger(row)) return "invalid request";
  if (col < 0 || row < 0 || col + PORTAL_TILES > mapCols || row + PORTAL_TILES > mapRows) {
    return "that is outside the map";
  }
  const overlaps = others.some(
    (o) => Math.abs(o.col - col) < PORTAL_TILES && Math.abs(o.row - row) < PORTAL_TILES,
  );
  return overlaps ? "another portal is there" : undefined;
}

export const LINK_ROUTES = {
  // Append /:id/connect-code, /:id/links, /:id/links/:linkId/approve under SPACE_ROUTES.PREFIX.
  CONNECT_CODE: "/connect-code",
  LINKS: "/links",
} as const;
