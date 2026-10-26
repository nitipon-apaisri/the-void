import type { IpcMainInvokeEvent } from "electron";

import { originOf } from "../origin";

/** Only our own page, in its top frame, may use the shell's IPC channels. */
export function assertTrusted(event: IpcMainInvokeEvent, trustedOrigin: string) {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame || originOf(frame.url) !== trustedOrigin) {
    throw new Error("untrusted sender");
  }
}
