/** What a player tells the others about themselves. Not saved: everyone starts available. */
export const PLAYER_STATUSES = ["available", "away", "busy"] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  available: "Available",
  away: "Away",
  busy: "Do not disturb",
};

export const STATUS_COLORS: Record<PlayerStatus, string> = {
  available: "#4ade80",
  away: "#fbbf24",
  busy: "#f87171",
};

export interface SetStatusPayload {
  status: PlayerStatus;
}

export const isPlayerStatus = (value: unknown): value is PlayerStatus =>
  typeof value === "string" && (PLAYER_STATUSES as readonly string[]).includes(value);
