// A pick is only honoured shortly after it is made, and only once.
const CHOICE_TTL_MS = 30_000;

export interface ScreenSelection {
  /** Remember which sources the renderer was shown; only these can be chosen. */
  offer(ids: Iterable<string>): void;
  /** False if the id was never offered. */
  choose(id: string, audio?: boolean): boolean;
  /** The chosen id and whether to capture the computer's sound, consumed so one pick authorises one capture. */
  take(): { id: string; audio: boolean } | undefined;
}

export function createScreenSelection(now: () => number = Date.now): ScreenSelection {
  let offered = new Set<string>();
  let chosen: { id: string; audio: boolean; at: number } | undefined;

  return {
    offer(ids) {
      offered = new Set(ids);
      chosen = undefined;
    },
    choose(id, audio = false) {
      if (!offered.has(id)) return false;
      chosen = { id, audio, at: now() };
      return true;
    },
    take() {
      const pick = chosen;
      chosen = undefined;
      return pick && now() - pick.at <= CHOICE_TTL_MS
        ? { id: pick.id, audio: pick.audio }
        : undefined;
    },
  };
}
