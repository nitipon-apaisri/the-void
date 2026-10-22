/**
 * Which screen shares to receive: the nearest `max` sharers among those in range.
 * `nearestFirst` is the in-range players ordered by distance; `sharing` is who is sharing.
 */
export function pickScreenSharers(
  nearestFirst: readonly string[],
  sharing: ReadonlySet<string>,
  max: number,
): Set<string> {
  const picked = new Set<string>();
  for (const id of nearestFirst) {
    if (picked.size >= max) break;
    if (sharing.has(id)) picked.add(id);
  }
  return picked;
}
