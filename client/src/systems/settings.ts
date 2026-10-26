export type KeyScheme = "arrows" | "wasd" | "both";

export interface Settings {
  /** Hearing and seeing range, in tiles. */
  proximityTiles: number;
  /** Empty string means the system default device. */
  micDeviceId: string;
  cameraDeviceId: string;
  speakerDeviceId: string;
  /** 0 to 1, applied to everyone you hear. */
  volume: number;
  keys: KeyScheme;
  /** Camera zoom. Whole numbers keep pixel art crisp; the others trade that for a bigger view. */
  zoom: number;
  /** Frame rate cap. 30 saves battery on laptops. */
  maxFps: number;
  showNames: boolean;
  /** System notifications for waves and knocks while the app is in the background. */
  notifications: boolean;
}

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2, 3] as const;
export const FPS_OPTIONS = [30, 60] as const;

export const PROXIMITY_MIN_TILES = 0.5;
export const PROXIMITY_MAX_TILES = 6;
export const PROXIMITY_STEP_TILES = 0.25;

const SCHEMES: readonly KeyScheme[] = ["arrows", "wasd", "both"];

export const defaultSettings = (proximityTiles: number): Settings => ({
  proximityTiles,
  micDeviceId: "",
  cameraDeviceId: "",
  speakerDeviceId: "",
  volume: 1,
  keys: "arrows",
  zoom: 1,
  maxFps: 60,
  showNames: true,
  notifications: true,
});

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const finite = (raw: unknown): number | undefined =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;

const text = (raw: unknown, fallback: string) => (typeof raw === "string" ? raw : fallback);

const oneOf = (raw: unknown, allowed: readonly number[], fallback: number) =>
  typeof raw === "number" && allowed.includes(raw) ? raw : fallback;

/** Fills gaps and clamps what was stored, so an edited or older save can never break the app. */
export function sanitizeSettings(raw: unknown, defaults: Settings): Settings {
  const saved = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const tiles = finite(saved.proximityTiles);
  const volume = finite(saved.volume);
  return {
    proximityTiles:
      tiles === undefined
        ? defaults.proximityTiles
        : clamp(tiles, PROXIMITY_MIN_TILES, PROXIMITY_MAX_TILES),
    micDeviceId: text(saved.micDeviceId, defaults.micDeviceId),
    cameraDeviceId: text(saved.cameraDeviceId, defaults.cameraDeviceId),
    speakerDeviceId: text(saved.speakerDeviceId, defaults.speakerDeviceId),
    volume: volume === undefined ? defaults.volume : clamp(volume, 0, 1),
    keys: SCHEMES.includes(saved.keys as KeyScheme) ? (saved.keys as KeyScheme) : defaults.keys,
    zoom: oneOf(saved.zoom, ZOOM_LEVELS, defaults.zoom),
    maxFps: oneOf(saved.maxFps, FPS_OPTIONS, defaults.maxFps),
    showNames: typeof saved.showNames === "boolean" ? saved.showNames : defaults.showNames,
    notifications:
      typeof saved.notifications === "boolean" ? saved.notifications : defaults.notifications,
  };
}
