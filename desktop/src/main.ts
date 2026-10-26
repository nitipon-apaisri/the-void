import { app, BrowserWindow, session } from "electron";
import path from "node:path";

import { createScreenSelection } from "./ipc/screen-selection";
import { registerNotifyIpc } from "./ipc/notify";
import { registerScreenIpc } from "./ipc/screen";
import { originOf } from "./origin";
import { APP_URL, registerAppScheme, serveApp } from "./windows/app-protocol";
import { createMainWindow } from "./windows/main-window";

// A packaged app always shows its own built client; the override is for development only, so an
// environment variable cannot point a window that has the preload bridge at another page.
const CLIENT_URL = app.isPackaged ? APP_URL : (process.env.CLIENT_URL ?? "http://localhost:5173");
const CLIENT_ORIGIN = originOf(CLIENT_URL) ?? "";

// Development runs the stock Electron bundle, so name the app here; a packaged one already has it.
app.setName("The Void");
registerAppScheme();

// Permissions are granted only to our own page.
const ALLOWED_PERMISSIONS = ["media", "display-capture", "fullscreen"];
app.whenReady().then(() => {
  if (app.isPackaged) serveApp(path.join(process.resourcesPath, "client"));
  // In development the Dock shows Electron's own icon; a packaged app gets ours from the bundle.
  else app.dock?.setIcon(path.join(__dirname, "../build/icon.png"));
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb, details) =>
    cb(
      ALLOWED_PERMISSIONS.includes(permission) && originOf(details.requestingUrl) === CLIENT_ORIGIN,
    ),
  );
  registerScreenIpc(CLIENT_ORIGIN, createScreenSelection());
  let mainWindow = createMainWindow(CLIENT_URL);
  registerNotifyIpc(CLIENT_ORIGIN, () => mainWindow);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow(CLIENT_URL);
  });
});

app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
