// shared
import {
  canBanMember,
  canChangeRole,
  canManageMembers,
  canRemoveMember,
  type BannedMember,
  type MemberEvent,
  type SpaceRole,
} from "@void/shared";

import type { BanRepository } from "../repositories/ban.repository.js";
import { isUuid, type SpaceRepository } from "../repositories/space.repository.js";
import type { TableRepository } from "../repositories/table.repository.js";
import { AuthError } from "./auth.service.js";

/** Tells the rooms of a space that who may be in it changed. */
export interface MemberEvents {
  publish(spaceId: string, event: MemberEvent): void;
}

export interface MemberService {
  /** The user removes themselves (leaving) or, with the right role, someone else. */
  remove(actorId: string, spaceId: string, targetId: string): Promise<void>;
  /** Promote to admin, demote to member, or hand the space over with "owner". */
  setRole(actorId: string, spaceId: string, targetId: string, role: SpaceRole): Promise<void>;
  /** Removes a member and bars them from coming back through a link or code. */
  ban(actorId: string, spaceId: string, targetId: string): Promise<void>;
  /** Owners and admins. The person needs a new link or code to come back. */
  unban(actorId: string, spaceId: string, targetId: string): Promise<void>;
  bans(actorId: string, spaceId: string): Promise<BannedMember[]>;
}

interface Deps {
  spaces: SpaceRepository;
  bans: BanRepository;
  claims: Pick<TableRepository, "release">;
  events: MemberEvents;
}

export function createMemberService({ spaces, bans, claims, events }: Deps): MemberService {
  // Same answer for a space that does not exist and one you are not in.
  const both = async (actorId: string, spaceId: string, targetId: string) => {
    if (!isUuid(spaceId) || !isUuid(targetId)) throw new AuthError(403, "you may not do that");
    const actor = await spaces.findMembership(spaceId, actorId);
    if (!actor) throw new AuthError(403, "you may not do that");
    const target = await spaces.findMembership(spaceId, targetId);
    if (!target) throw new AuthError(400, "that person is not in this space");
    return { actor: actor.role, target: target.role };
  };

  const requireManager = async (actorId: string, spaceId: string) => {
    const actor = isUuid(spaceId) ? await spaces.findMembership(spaceId, actorId) : undefined;
    if (!actor || !canManageMembers(actor.role)) {
      throw new AuthError(403, "only an owner or admin can do this");
    }
  };

  return {
    async remove(actorId, spaceId, targetId) {
      const { actor, target } = await both(actorId, spaceId, targetId);
      const self = actorId === targetId;
      if (!canRemoveMember(actor, target, self)) {
        throw new AuthError(
          403,
          self ? "hand the space over to someone before you leave" : "you may not remove them",
        );
      }
      if (!(await spaces.removeMember(spaceId, targetId))) {
        throw new AuthError(400, "that person is not in this space");
      }
      // Their desk goes with them; the room drops it from its state when it hears the event.
      await claims.release(spaceId, targetId);
      events.publish(spaceId, { kind: "removed", userId: targetId });
    },

    async setRole(actorId, spaceId, targetId, role) {
      const { actor, target } = await both(actorId, spaceId, targetId);
      if (!canChangeRole(actor, target, role, actorId === targetId)) {
        throw new AuthError(403, "you may not change their role");
      }
      if (role === "owner") {
        if (!(await spaces.transferOwnership(spaceId, actorId, targetId))) {
          throw new AuthError(409, "the space could not be handed over");
        }
        events.publish(spaceId, { kind: "role", userId: actorId, role: "admin" });
      } else if (!(await spaces.setRole(spaceId, targetId, role))) {
        throw new AuthError(409, "their role could not be changed");
      }
      events.publish(spaceId, { kind: "role", userId: targetId, role });
    },

    async ban(actorId, spaceId, targetId) {
      const { actor, target } = await both(actorId, spaceId, targetId);
      if (!canBanMember(actor, target)) throw new AuthError(403, "you may not ban them");
      if (!(await bans.ban(spaceId, targetId, actorId))) {
        throw new AuthError(409, "they are already banned");
      }
      await claims.release(spaceId, targetId);
      // The room treats a ban like a removal: it tells them and drops them.
      events.publish(spaceId, { kind: "removed", userId: targetId });
    },

    async unban(actorId, spaceId, targetId) {
      await requireManager(actorId, spaceId);
      if (!isUuid(targetId) || !(await bans.unban(spaceId, targetId))) {
        throw new AuthError(400, "they are not banned");
      }
    },

    async bans(actorId, spaceId) {
      await requireManager(actorId, spaceId);
      return bans.list(spaceId);
    },
  };
}
