import {
  desktopCapturer,
  ipcMain,
  session,
  shell,
  systemPreferences,
  type IpcMainInvokeEvent,
} from "electron";

import { DESKTOP_IPC, type ScreenSourceList } from "@void/shared";

import type { ScreenSelection } from "./screen-selection";

const THUMBNAIL = { width: 320, height: 200 };
const MAC_SCREEN_SETTINGS =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

/**
 * Screen sharing in the desktop app: the renderer shows its own picker, tells the main
 * process which source was chosen, then calls getDisplayMedia, which this handler answers.
 */
export function registerScreenIpc(trustedOrigin: string, selection: ScreenSelection) {
  // Only our own page, in its top frame, may use these channels.
  const assertTrusted = (event: IpcMainInvokeEvent) => {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame || originOf(frame.url) !== trustedOrigin) {
      throw new Error("untrusted sender");
    }
  };

  ipcMain.handle(DESKTOP_IPC.LIST_SCREENS, async (event): Promise<ScreenSourceList> => {
    assertTrusted(event);
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

  ipcMain.handle(DESKTOP_IPC.SELECT_SCREEN, (event, id: unknown) => {
    assertTrusted(event);
    if (typeof id !== "string" || !selection.choose(id)) throw new Error("unknown source");
  });

  ipcMain.handle(DESKTOP_IPC.OPEN_SCREEN_SETTINGS, async (event) => {
    assertTrusted(event);
    if (process.platform === "darwin") await shell.openExternal(MAC_SCREEN_SETTINGS);
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const id = selection.take();
    // Deny anything that was not just picked in our own picker.
    if (!id || originOf(request.frame?.url ?? "") !== trustedOrigin) return callback({});
    const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
    const source = sources.find((candidate) => candidate.id === id);
    // No audio: system audio capture differs by OS and is out of scope for now.
    callback(source ? { video: source } : {});
  });
}
