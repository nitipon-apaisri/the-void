// shared
import type { AuthSession } from "@void/shared";

import { loadJson, saveJson } from "./storage";

const KEY = "void.session";

// localStorage is readable by any script on the page. That is acceptable while the client
// loads only our own bundle; revisit (OS keychain via the Electron main process) if that changes.
export const loadSession = () => {
  const saved = loadJson<Partial<AuthSession>>(KEY);
  return typeof saved?.token === "string" && saved.user ? (saved as AuthSession) : undefined;
};

export const saveSession = (session: AuthSession) => saveJson(KEY, session);

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
