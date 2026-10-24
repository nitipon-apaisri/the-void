// Who we hear and see. Inside a meeting room everyone in it is in the
// call, wherever they stand; the room and the people outside do not reach each other at all.
import { nearbyIds, type Positioned } from "./proximity";

export interface Placed extends Positioned {
  /** The meeting room they stand in ("" when none), as the server says. */
  zone: string;
}

/** Ids of the others we are connected to. `previous` supplies the distance hysteresis. */
export function audienceIds(
  me: { x: number; y: number; zone: string },
  others: Iterable<Placed>,
  radius: number,
  previous: ReadonlySet<string> = new Set(),
): Set<string> {
  const heard = new Set<string>();
  const open: Placed[] = [];
  for (const other of others) {
    if (me.zone || other.zone) {
      if (other.zone === me.zone) heard.add(other.id);
    } else {
      open.push(other);
    }
  }
  for (const id of nearbyIds(me, open, radius, previous)) heard.add(id);
  return heard;
}
