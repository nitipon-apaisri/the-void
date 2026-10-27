import { Menu, nativeImage, Tray } from "electron";
import path from "node:path";

import type { PlayerStatus } from "@void/shared";

import { trayMenuTemplate, type TrayActions } from "./tray-menu";

const WINDOWS_ICON_SIZE = 16;

// macOS tints a "...Template" image to suit the menu bar, light or dark (the @2x file next to it
// is picked up by itself). The other systems get a white icon, which suits their usual dark tray.
function trayIcon(dir: string) {
  if (process.platform === "darwin") {
    return nativeImage.createFromPath(path.join(dir, "trayTemplate.png"));
  }
  return nativeImage
    .createFromPath(path.join(dir, "tray.png"))
    .resize({ width: WINDOWS_ICON_SIZE });
}

export interface TrayHandle {
  setStatus(status: PlayerStatus): void;
}

/** A menu bar / system tray icon that brings the window back and switches status. */
export function createTray(iconDir: string, actions: TrayActions): TrayHandle {
  const tray = new Tray(trayIcon(iconDir));
  tray.setToolTip("The Void");
  let status: PlayerStatus = "available";
  const refresh = () =>
    tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate(status, actions)));
  refresh();
  // Windows and Linux open the window on a click; macOS shows the menu.
  tray.on("click", actions.open);
  return {
    setStatus(next) {
      if (next === status) return;
      status = next;
      refresh();
    },
  };
}
