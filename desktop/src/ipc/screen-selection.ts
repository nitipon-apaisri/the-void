// A pick is only honoured shortly after it is made, and only once.
const CHOICE_TTL_MS = 30_000;

export interface ScreenSelection {
  /** Remember which sources the renderer was shown; only these can be chosen. */
  offer(ids: Iterable<string>): void;
  /** False if the id was never offered. */
  choose(id: string): boolean;
  /** The chosen id, consumed so one pick authorises one capture. */
  take(): string | undefined;
}

export function createScreenSelection(now: () => number = Date.now): ScreenSelection {
  let offered = new Set<string>();
  let chosen: { id: string; at: number } | undefined;

  return {
    offer(ids) {
      offered = new Set(ids);
      chosen = undefined;
    },
    choose(id) {
      if (!offered.has(id)) return false;
      chosen = { id, at: now() };
      return true;
    },
    take() {
      const pick = chosen;
      chosen = undefined;
      return pick && now() - pick.at <= CHOICE_TTL_MS ? pick.id : undefined;
    },
  };
}
