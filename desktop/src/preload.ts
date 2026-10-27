import { contextBridge, ipcRenderer } from "electron";

import { DESKTOP_IPC, isPlayerStatus, type DesktopBridge } from "@void/shared";

// The whole surface the page gets from the desktop shell. Keep it small and typed.
const bridge: DesktopBridge = {
  listScreenSources: () => ipcRenderer.invoke(DESKTOP_IPC.LIST_SCREENS),
  selectScreenSource: (id, audio) => ipcRenderer.invoke(DESKTOP_IPC.SELECT_SCREEN, id, audio),
  notify: (title, body) => ipcRenderer.invoke(DESKTOP_IPC.NOTIFY, title, body),
  openScreenSettings: () => ipcRenderer.invoke(DESKTOP_IPC.OPEN_SCREEN_SETTINGS),
  setTrayStatus: (status) => ipcRenderer.invoke(DESKTOP_IPC.TRAY_STATUS, status),
  onTrayStatus: (cb) => {
    const listener = (_event: unknown, status: unknown) => {
      if (isPlayerStatus(status)) cb(status);
    };
    ipcRenderer.on(DESKTOP_IPC.TRAY_COMMAND, listener);
    return () => void ipcRenderer.removeListener(DESKTOP_IPC.TRAY_COMMAND, listener);
  },
};

contextBridge.exposeInMainWorld("voidDesktop", bridge);
