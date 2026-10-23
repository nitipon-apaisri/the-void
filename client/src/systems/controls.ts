import type { KeyScheme } from "./settings";

export interface HeldKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface MoveKeys {
  arrows: HeldKeys;
  wasd: HeldKeys;
}

/** Movement direction (-1, 0 or 1 per axis) from whichever keys the chosen scheme listens to. */
export function readDirection(keys: MoveKeys, scheme: KeyScheme): { dx: number; dy: number } {
  const sets =
    scheme === "arrows"
      ? [keys.arrows]
      : scheme === "wasd"
        ? [keys.wasd]
        : [keys.arrows, keys.wasd];
  const held = (pick: (k: HeldKeys) => boolean) => sets.some(pick);
  return {
    dx: (held((k) => k.right) ? 1 : 0) - (held((k) => k.left) ? 1 : 0),
    dy: (held((k) => k.down) ? 1 : 0) - (held((k) => k.up) ? 1 : 0),
  };
}
