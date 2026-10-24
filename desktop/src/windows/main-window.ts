import { BrowserWindow, shell } from "electron";
import path from "node:path";

import { originOf } from "../origin";

export function createMainWindow(url: string): BrowserWindow {
  const origin = originOf(url);
  if (!origin) throw new Error(`cannot load ${url}`);
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // The preload API must never be reachable from a foreign page.
  win.webContents.on("will-navigate", (event, target) => {
    if (originOf(target) !== origin) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target)) void shell.openExternal(target);
    return { action: "deny" };
  });

  // Pinch and Cmd/Ctrl + wheel zoom the game camera, not the page, so the browser's own
  // pinch-zoom must stay off for those events to reach the client.
  // Set once a page exists: before that it rejects, and a new page starts with the defaults.
  win.webContents.on("did-finish-load", () => {
    win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  });

  void win.loadURL(url);
  return win;
}
