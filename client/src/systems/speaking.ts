/**
 * Who to show as talking: the speakers the server reports, limited to the people in hearing
 * range. A person talking across the map is not heard, so showing them would only be confusing.
 */
export function audibleSpeakers(
  speaking: ReadonlySet<string>,
  nearby: ReadonlySet<string>,
): Set<string> {
  const heard = new Set<string>();
  for (const id of speaking) if (nearby.has(id)) heard.add(id);
  return heard;
}
