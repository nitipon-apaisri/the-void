import { Menu, nativeImage, Tray } from "electron";

import type { PlayerStatus } from "@void/shared";

import { trayMenuTemplate, type TrayActions } from "./tray-menu";

const ICON_SIZE = 18;

export interface TrayHandle {
  setStatus(status: PlayerStatus): void;
}

/** A menu bar / system tray icon that brings the window back and switches status. */
export function createTray(iconPath: string, actions: TrayActions): TrayHandle {
  const tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: ICON_SIZE }));
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
