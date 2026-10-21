import { app, BrowserWindow, session } from "electron";

const DEV_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadURL(DEV_URL);
}

app.whenReady().then(() => {
  // Camera/mic are needed later for proximity video; screen capture picker comes with that step.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) =>
    cb(["media", "fullscreen"].includes(permission)),
  );
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
