export interface Positioned {
  id: string;
  x: number;
  y: number;
}

// Leaving needs a bigger distance than entering, so two players standing on the
// boundary do not flip their audio on and off every tick.
const LEAVE_MARGIN = 1.2;

/** Ids of the others within `radius` of `me`; `previous` supplies the hysteresis. */
export function nearbyIds(
  me: { x: number; y: number },
  others: Iterable<Positioned>,
  radius: number,
  previous: ReadonlySet<string> = new Set(),
): Set<string> {
  const result = new Set<string>();
  for (const other of others) {
    const limit = previous.has(other.id) ? radius * LEAVE_MARGIN : radius;
    if (Math.hypot(other.x - me.x, other.y - me.y) <= limit) result.add(other.id);
  }
  return result;
}
