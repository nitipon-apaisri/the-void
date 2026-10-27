import { app, session, type BrowserWindow } from "electron";
import path from "node:path";

import { DESKTOP_IPC } from "@void/shared";

import { createScreenSelection } from "./ipc/screen-selection";
import { registerNotifyIpc } from "./ipc/notify";
import { registerScreenIpc } from "./ipc/screen";
import { registerTrayIpc } from "./ipc/tray";
import { originOf } from "./origin";
import { APP_URL, registerAppScheme, serveApp } from "./windows/app-protocol";
import { createMainWindow } from "./windows/main-window";
import { createTray } from "./windows/tray";

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
  const open = () => {
    if (mainWindow.isDestroyed()) mainWindow = makeWindow();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };
  const makeWindow = () => {
    const win = createMainWindow(CLIENT_URL);
    // Closing the window leaves the app in the tray, so waves and knocks still reach the person.
    win.on("close", (event) => {
      if (quitting) return;
      event.preventDefault();
      win.hide();
    });
    return win;
  };
  let mainWindow: BrowserWindow = makeWindow();
  registerNotifyIpc(CLIENT_ORIGIN, () => mainWindow);
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "../build/icon.png");
  registerTrayIpc(
    CLIENT_ORIGIN,
    createTray(iconPath, {
      open,
      quit: () => app.quit(),
      setStatus: (status) => {
        if (!mainWindow.isDestroyed())
          mainWindow.webContents.send(DESKTOP_IPC.TRAY_COMMAND, status);
      },
    }),
  );
  app.on("activate", open);
});

// Set before the windows are asked to close, so quitting is not turned into hiding.
let quitting = false;
app.on("before-quit", () => (quitting = true));
