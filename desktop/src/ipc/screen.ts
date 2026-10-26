import {
  desktopCapturer,
  ipcMain,
  session,
  shell,
  systemPreferences,
  type IpcMainInvokeEvent,
} from "electron";

import { DESKTOP_IPC, type ScreenSourceList } from "@void/shared";

import { originOf } from "../origin";
import type { ScreenSelection } from "./screen-selection";
import { assertTrusted } from "./trusted";

const THUMBNAIL = { width: 320, height: 200 };
const MAC_SCREEN_SETTINGS =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";

/**
 * Screen sharing in the desktop app: the renderer shows its own picker, tells the main
 * process which source was chosen, then calls getDisplayMedia, which this handler answers.
 */
export function registerScreenIpc(trustedOrigin: string, selection: ScreenSelection) {
  const trust = (event: IpcMainInvokeEvent) => assertTrusted(event, trustedOrigin);

  ipcMain.handle(DESKTOP_IPC.LIST_SCREENS, async (event): Promise<ScreenSourceList> => {
    trust(event);
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: THUMBNAIL,
      fetchWindowIcons: false,
    });
    selection.offer(sources.map((source) => source.id));
    return {
      sources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.id.startsWith("screen:") ? "screen" : "window",
        thumbnail: source.thumbnail.toDataURL(),
      })),
      needsPermission:
        process.platform === "darwin" &&
        systemPreferences.getMediaAccessStatus("screen") !== "granted",
    };
  });

  ipcMain.handle(DESKTOP_IPC.SELECT_SCREEN, (event, id: unknown, audio: unknown) => {
    trust(event);
    if (typeof id !== "string" || !selection.choose(id, audio === true)) {
      throw new Error("unknown source");
    }
  });

  ipcMain.handle(DESKTOP_IPC.OPEN_SCREEN_SETTINGS, async (event) => {
    trust(event);
    if (process.platform === "darwin") await shell.openExternal(MAC_SCREEN_SETTINGS);
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const pick = selection.take();
    // Deny anything that was not just picked in our own picker.
    if (!pick || originOf(request.frame?.url ?? "") !== trustedOrigin) return callback({});
    const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
    const source = sources.find((candidate) => candidate.id === pick.id);
    // Sound is the sharer's choice: it carries everything the computer plays, other people's
    // voices from this app included. "loopback" is system audio on Windows and recent macOS.
    callback(
      source ? { video: source, ...(pick.audio ? { audio: "loopback" as const } : {}) } : {},
    );
  });
}
