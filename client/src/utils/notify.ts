// shared
import type { NotifyResult } from "@void/shared";

// utils
import { desktopBridge } from "./desktop-bridge";

/** How a request ended; the browser adds the permission outcomes. */
export type NotifyOutcome = NotifyResult | "no-permission" | "blocked" | "error";

export const NOTIFY_OUTCOME_TEXT: Record<NotifyOutcome, string> = {
  shown: "Sent. If you saw nothing, the system hid it (check Focus mode).",
  unsupported: "This system does not support notifications.",
  denied:
    "macOS has not allowed notifications for this app. Turn them on in System Settings > Notifications.",
  throttled: "Too soon after the last one; try again.",
  unconfirmed:
    "The system did not confirm it. Allow notifications for this app in System Settings.",
  "no-permission": "The browser has not been given permission. Switch the setting off and on.",
  blocked: "The browser blocked notifications for this site. Allow them in its site settings.",
  error: "Something went wrong; see the console.",
};

/** A system notification: the desktop shell's when there is one, else the browser's if allowed. */
export async function notify(title: string, body: string): Promise<NotifyOutcome> {
  let outcome: NotifyOutcome;
  try {
    const bridge = desktopBridge();
    if (bridge) {
      outcome = await bridge.notify(title, body);
    } else if (typeof Notification === "undefined") {
      outcome = "unsupported";
    } else if (Notification.permission === "granted") {
      const note = new Notification(title, { body });
      note.addEventListener("click", () => {
        window.focus();
        note.close();
      });
      outcome = "shown";
    } else {
      outcome = Notification.permission === "denied" ? "blocked" : "no-permission";
    }
  } catch (err) {
    console.warn("notification failed", err);
    outcome = "error";
  }
  if (outcome !== "shown") console.warn(`notification not shown: ${outcome}`);
  return outcome;
}

/** Browsers ask once, and only from a click; the desktop app needs no permission. */
export function requestNotifyPermission() {
  if (desktopBridge() || typeof Notification === "undefined") return;
  if (Notification.permission === "default") void Notification.requestPermission();
}
