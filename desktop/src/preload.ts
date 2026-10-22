import { contextBridge, ipcRenderer } from "electron";

import { DESKTOP_IPC, type DesktopBridge } from "@void/shared";

// The whole surface the page gets from the desktop shell. Keep it small and typed.
const bridge: DesktopBridge = {
  listScreenSources: () => ipcRenderer.invoke(DESKTOP_IPC.LIST_SCREENS),
  selectScreenSource: (id) => ipcRenderer.invoke(DESKTOP_IPC.SELECT_SCREEN, id),
  openScreenSettings: () => ipcRenderer.invoke(DESKTOP_IPC.OPEN_SCREEN_SETTINGS),
};

contextBridge.exposeInMainWorld("voidDesktop", bridge);
