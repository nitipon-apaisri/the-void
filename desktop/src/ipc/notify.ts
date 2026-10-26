import { ipcMain, Notification, type BrowserWindow } from "electron";

import { DESKTOP_IPC, type NotifyResult } from "@void/shared";

import { assertTrusted } from "./trusted";

const MAX_TITLE = 80;
const MAX_BODY = 200;
// A page that misbehaves cannot flood the desktop with notifications.
const MIN_GAP_MS = 1000;
// How long to wait for the system to say it showed the notification.
const CONFIRM_MS = 2000;

/** A system notification the page asks for; clicking it brings the window to the front. */
export function registerNotifyIpc(
  trustedOrigin: string,
  getWindow: () => BrowserWindow | undefined,
  now: () => number = Date.now,
) {
  let last = 0;
  ipcMain.handle(
    DESKTOP_IPC.NOTIFY,
    (event, title: unknown, body: unknown): Promise<NotifyResult> | NotifyResult => {
      assertTrusted(event, trustedOrigin);
      if (typeof title !== "string" || typeof body !== "string") throw new Error("invalid request");
      if (!Notification.isSupported()) {
        console.warn("notifications are not supported on this system");
        return "unsupported";
      }
      if (now() - last < MIN_GAP_MS) return "throttled";
      last = now();
      const notification = new Notification({
        title: title.slice(0, MAX_TITLE),
        body: body.slice(0, MAX_BODY),
      });
      notification.on("click", () => {
        const win = getWindow();
        if (!win || win.isDestroyed()) return;
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      });
      return new Promise<NotifyResult>((resolve) => {
        const timer = setTimeout(() => {
          console.warn("notification: the system did not confirm it was shown (check permission)");
          resolve("unconfirmed");
        }, CONFIRM_MS);
        notification.on("show", () => {
          clearTimeout(timer);
          resolve("shown");
        });
        notification.on("failed", (_event, error) => {
          clearTimeout(timer);
          console.warn("notification failed:", error);
          // macOS: UNErrorDomain error 1 is "notifications not allowed" for this app.
          resolve(
            /UNErrorDomain error 1\b|not allowed/i.test(String(error)) ? "denied" : "unconfirmed",
          );
        });
        notification.show();
      });
    },
  );
}
