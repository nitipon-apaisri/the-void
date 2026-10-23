// shared
import { LOOK_COUNTS, NO_ACCESSORY, type Look, type LookPart } from "@void/shared";

/** One file of a part, as the art import describes it. */
export interface LookEntry {
  style: number;
  /** Only accessories are named ("Bee"); the rest are numbered. */
  name: string;
  /** The colour: Outfit_03_..._02 is style 3 in its second colour. */
  variant: number;
}

/** A style and the part indices (one per colour) that draw it. */
export interface StyleGroup {
  style: number;
  name: string;
  indices: number[];
}

/** Groups a part's files by style; colours inside a style are ordered by variant. */
export function groupStyles(entries: readonly LookEntry[]): StyleGroup[] {
  const groups = new Map<number, StyleGroup & { variants: number[] }>();
  entries.forEach((entry, index) => {
    let group = groups.get(entry.style);
    if (!group) {
      group = { style: entry.style, name: entry.name, indices: [], variants: [] };
      groups.set(entry.style, group);
    }
    group.indices.push(index);
    group.variants.push(entry.variant);
  });
  return [...groups.values()]
    .sort((a, b) => a.style - b.style)
    .map(({ style, name, indices, variants }) => ({
      style,
      name,
      indices: indices
        .map((index, i) => ({ index, variant: variants[i]! }))
        .sort((a, b) => a.variant - b.variant)
        .map((item) => item.index),
    }));
}

/** `index + delta`, wrapping around a list of `length`. */
export const wrap = (index: number, delta: number, length: number) =>
  (((index + delta) % length) + length) % length;

/** Where a part index sits: which group and which colour inside it. -1 for no accessory. */
export function locate(groups: readonly StyleGroup[], index: number) {
  const group = groups.findIndex((g) => g.indices.includes(index));
  return group < 0 ? undefined : { group, colour: groups[group]!.indices.indexOf(index) };
}

/**
 * The part index after stepping the style by `delta`, keeping the same colour number where the
 * new style has it. With `optional` the list has a leading "none", which is NO_ACCESSORY.
 */
export function stepStyle(
  groups: readonly StyleGroup[],
  index: number,
  delta: number,
  optional: boolean,
): number {
  const found = locate(groups, index);
  // Slot 0 is "none" when optional; real styles follow.
  const slots = groups.length + (optional ? 1 : 0);
  const slot = found ? found.group + (optional ? 1 : 0) : 0;
  const next = wrap(slot, delta, slots);
  if (optional && next === 0) return NO_ACCESSORY;
  const target = groups[next - (optional ? 1 : 0)]!;
  return target.indices[Math.min(found?.colour ?? 0, target.indices.length - 1)]!;
}

/** The part index after stepping the colour inside the current style. */
export function stepColour(groups: readonly StyleGroup[], index: number, delta: number): number {
  const found = locate(groups, index);
  if (!found) return index;
  const { indices } = groups[found.group]!;
  return indices[wrap(found.colour, delta, indices.length)]!;
}

/** A random look; `rng` returns [0, 1) so tests can fix it. About a third have an accessory. */
export function randomLook(rng: () => number = Math.random): Look {
  const pick = (part: LookPart) => Math.floor(rng() * LOOK_COUNTS[part]);
  return {
    body: pick("body"),
    eyes: pick("eyes"),
    outfit: pick("outfit"),
    hair: pick("hair"),
    accessory: rng() < 1 / 3 ? pick("accessory") : NO_ACCESSORY,
  };
}
