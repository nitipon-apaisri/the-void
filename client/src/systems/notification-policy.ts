import type { PlayerStatus } from "@void/shared";

/**
 * Whether a wave or a knock earns a system notification: only when asked for, not while on do
 * not disturb, and not while the window is in front (the toast and the knock card show it there).
 */
export function shouldNotify(state: {
  enabled: boolean;
  status: PlayerStatus;
  focused: boolean;
}): boolean {
  return state.enabled && state.status !== "busy" && !state.focused;
}
