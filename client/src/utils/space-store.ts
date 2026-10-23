import { loadJson, saveJson } from "./storage";

const KEY = "void.space";

// Per device, per account: which space to open without asking, so a sign-in on a shared
// computer does not drop someone else's next account into the previous one's space.
export const loadLastSpace = (userId: string): string | undefined => {
  const saved = loadJson<{ userId?: unknown; spaceId?: unknown }>(KEY);
  return saved?.userId === userId && typeof saved.spaceId === "string" ? saved.spaceId : undefined;
};

export const saveLastSpace = (userId: string, spaceId: string) =>
  saveJson(KEY, { userId, spaceId });

export function forgetLastSpace() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
