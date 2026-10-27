// shared
import type { PlayerStatus } from "@void/shared";

// utils
import { desktopBridge } from "./desktop-bridge";

export interface TrayLink {
  /** Tells the tray menu which status is current. */
  setStatus(status: PlayerStatus): void;
  dispose(): void;
}

/** Links the desktop tray menu to the status: it follows ours and can change it. No-op in a browser. */
export function connectTray(onPick: (status: PlayerStatus) => void): TrayLink {
  const bridge = desktopBridge();
  const stop = bridge?.onTrayStatus(onPick);
  return {
    setStatus: (status) => void bridge?.setTrayStatus(status).catch(() => {}),
    dispose: () => stop?.(),
  };
}
