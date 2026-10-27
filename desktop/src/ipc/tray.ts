import { ipcMain } from "electron";

import { DESKTOP_IPC, isPlayerStatus } from "@void/shared";

import type { TrayHandle } from "../windows/tray";
import { assertTrusted } from "./trusted";

/** The page tells the tray which status is current, so its menu ticks the right one. */
export function registerTrayIpc(trustedOrigin: string, tray: TrayHandle) {
  ipcMain.handle(DESKTOP_IPC.TRAY_STATUS, (event, status: unknown) => {
    assertTrusted(event, trustedOrigin);
    if (!isPlayerStatus(status)) throw new Error("invalid request");
    tray.setStatus(status);
  });
}
