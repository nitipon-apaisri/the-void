import { app, BrowserWindow, session } from "electron";
import path from "node:path";

import { createScreenSelection } from "./ipc/screen-selection";
import { registerScreenIpc } from "./ipc/screen";
import { originOf } from "./origin";
import { APP_URL, registerAppScheme, serveApp } from "./windows/app-protocol";
import { createMainWindow } from "./windows/main-window";

// A packaged app always shows its own built client; the override is for development only, so an
// environment variable cannot point a window that has the preload bridge at another page.
const CLIENT_URL = app.isPackaged ? APP_URL : (process.env.CLIENT_URL ?? "http://localhost:5173");
const CLIENT_ORIGIN = originOf(CLIENT_URL) ?? "";

registerAppScheme();

// Permissions are granted only to our own page.
const ALLOWED_PERMISSIONS = ["media", "display-capture", "fullscreen"];
app.whenReady().then(() => {
  if (app.isPackaged) serveApp(path.join(process.resourcesPath, "client"));
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
