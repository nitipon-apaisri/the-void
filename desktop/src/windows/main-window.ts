import { BrowserWindow, shell } from "electron";
import path from "node:path";

export function createMainWindow(url: string): BrowserWindow {
  const origin = new URL(url).origin;
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
    if (new URL(target).origin !== origin) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target)) void shell.openExternal(target);
    return { action: "deny" };
  });

  void win.loadURL(url);
  return win;
}
