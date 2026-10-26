// shared
import { isSpaceSize, isSpaceTemplate, type SpaceSize, type SpaceTemplate } from "@void/shared";

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

/** A space we are visiting through a portal, and the one we came from. */
export interface Visit {
  userId: string;
  space: { id: string; name: string; template: SpaceTemplate; size: SpaceSize };
  from: { id: string; name: string };
}

const VISIT_KEY = "void.visit";

// Per tab and read once: a reload of the tab opens the space it came from, so a visit never
// outlives the crossing that made it.
export function saveVisit(visit: Visit) {
  try {
    sessionStorage.setItem(VISIT_KEY, JSON.stringify(visit));
  } catch {
    // The crossing then lands in the last space; nothing worse.
  }
}

export function takeVisit(userId: string): Visit | undefined {
  try {
    const raw = sessionStorage.getItem(VISIT_KEY);
    sessionStorage.removeItem(VISIT_KEY);
    const visit = raw ? (JSON.parse(raw) as Visit) : undefined;
    const { space, from } = visit ?? {};
    const valid =
      visit?.userId === userId &&
      typeof space?.id === "string" &&
      typeof space.name === "string" &&
      isSpaceTemplate(space.template) &&
      isSpaceSize(space.size) &&
      typeof from?.id === "string" &&
      typeof from.name === "string";
    return valid ? visit : undefined;
  } catch {
    return undefined;
  }
}
