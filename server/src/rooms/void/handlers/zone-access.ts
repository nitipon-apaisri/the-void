// shared
import { KNOCK_COOLDOWN_MS, canEnterLockedZone, type SpaceRole } from "@void/shared";

/** Who may walk into a locked private room, and who is knocking. One per game room. */
export class ZoneAccess {
  private readonly admitted = new Map<string, Set<string>>();
  // The room each person is currently knocking on, by their session id.
  private readonly knocking = new Map<string, string>();
  private readonly lastKnock = new Map<string, number>();

  /** Whether `sessionId` may step into `zoneId`. Being in it already never needs a check. */
  mayEnter(zoneId: string, locked: boolean, sessionId: string, role: SpaceRole): boolean {
    return (
      !locked || canEnterLockedZone(role) || Boolean(this.admitted.get(zoneId)?.has(sessionId))
    );
  }

  /** Lets someone in until the room is unlocked or empties. */
  admit(zoneId: string, sessionId: string) {
    const set = this.admitted.get(zoneId) ?? new Set<string>();
    set.add(sessionId);
    this.admitted.set(zoneId, set);
  }

  /** Starts a knock; false when they are already knocking or knocked a moment ago. */
  startKnock(zoneId: string, sessionId: string, now: number): boolean {
    if (this.knocking.has(sessionId)) return false;
    if (now - (this.lastKnock.get(sessionId) ?? -Infinity) < KNOCK_COOLDOWN_MS) return false;
    this.lastKnock.set(sessionId, now);
    this.knocking.set(sessionId, zoneId);
    return true;
  }

  /** The room they are knocking on, if any. */
  knockingOn(sessionId: string): string | undefined {
    return this.knocking.get(sessionId);
  }

  endKnock(sessionId: string) {
    this.knocking.delete(sessionId);
  }

  /** Everyone knocking on this room. */
  knockersOf(zoneId: string): string[] {
    return [...this.knocking].filter(([, z]) => z === zoneId).map(([id]) => id);
  }

  /** The room opened up, emptied or went away: nobody stays let in. */
  reset(zoneId: string) {
    this.admitted.delete(zoneId);
  }

  forget(sessionId: string) {
    this.knocking.delete(sessionId);
    this.lastKnock.delete(sessionId);
    for (const set of this.admitted.values()) set.delete(sessionId);
  }
}
