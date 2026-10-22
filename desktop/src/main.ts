import { app, BrowserWindow, session } from "electron";

import { createScreenSelection } from "./ipc/screen-selection";
import { registerScreenIpc } from "./ipc/screen";
import { createMainWindow } from "./windows/main-window";

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";
const CLIENT_ORIGIN = new URL(CLIENT_URL).origin;

// Permissions are granted only to our own page.
const ALLOWED_PERMISSIONS = ["media", "display-capture", "fullscreen"];
const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb, details) =>
    cb(
      ALLOWED_PERMISSIONS.includes(permission) && originOf(details.requestingUrl) === CLIENT_ORIGIN,
    ),
  );
  registerScreenIpc(CLIENT_ORIGIN, createScreenSelection());
  createMainWindow(CLIENT_URL);
  app.on(
    "activate",
    () => BrowserWindow.getAllWindows().length === 0 && createMainWindow(CLIENT_URL),
  );
});

app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
