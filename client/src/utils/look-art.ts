// shared
import { LOOK_PARTS, type LookPart } from "@void/shared";

// systems
import type { LookEntry } from "../systems/look-groups";

// The character parts live in client/src/assets/game/looks, copied from the licensed pack by
// `npm run assets:import` and not committed. These globs are empty until that has been run.
const images = import.meta.glob("../assets/game/looks/*/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const manifests = import.meta.glob("../assets/game/looks/manifest.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<LookPart, LookEntry[]>>;

/** What the import found for each part; empty lists when the art has not been imported. */
export const lookManifest: Record<LookPart, LookEntry[]> = Object.values(manifests)[0] ?? {
  body: [],
  eyes: [],
  outfit: [],
  hair: [],
  accessory: [],
};

const urls = new Map<string, string>();
for (const [file, url] of Object.entries(images)) {
  const [, part, name] = /looks\/([a-z]+)\/(\d+)\.png$/.exec(file) ?? [];
  if (part && name) urls.set(`${part}:${Number(name)}`, url);
}

/** The picture for one part, or undefined for no accessory or a missing file. */
export const lookPartUrl = (part: LookPart, index: number): string | undefined =>
  urls.get(`${part}:${index}`);

export const hasLookArt = LOOK_PARTS.every((part) => lookManifest[part].length > 0);
