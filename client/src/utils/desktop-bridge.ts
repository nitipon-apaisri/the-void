// shared
import type { DesktopBridge } from "@void/shared";

declare global {
  interface Window {
    /** Present only inside the Electron shell; the browser build never has it. */
    voidDesktop?: DesktopBridge;
  }
}

export const desktopBridge = (): DesktopBridge | undefined => window.voidDesktop;
