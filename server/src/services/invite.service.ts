// lib
import { createHash, randomBytes } from "node:crypto";

// shared
import {
  canManageMembers,
  MAX_ACTIVE_INVITES,
  type CreatedInvite,
  type InviteOptions,
  type InvitePreview,
  type InviteResult,
  type InviteSummary,
  type JoinRequest,
} from "@void/shared";

import type { InviteRepository } from "../repositories/invite.repository.js";
import { isUuid, type SpaceRepository } from "../repositories/space.repository.js";
import { AuthError } from "./auth.service.js";

export interface InviteService {
  create(userId: string, spaceId: string, options: InviteOptions): Promise<CreatedInvite>;
  list(userId: string, spaceId: string): Promise<InviteSummary[]>;
  revoke(userId: string, spaceId: string, inviteId: string): Promise<void>;
  preview(userId: string, token: string): Promise<InvitePreview>;
  accept(userId: string, token: string): Promise<InviteResult>;
  requests(userId: string, spaceId: string): Promise<JoinRequest[]>;
  decide(userId: string, spaceId: string, applicantId: string, approve: boolean): Promise<void>;
}

/** The database keeps this, never the token itself. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// A real token is 43 base64url characters; anything else cannot match, so skip the query.
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export function createInviteService(
  invites: InviteRepository,
  spaces: SpaceRepository,
): InviteService {
  // Same answer for a space that does not exist and one you may not manage.
  const requireManager = async (userId: string, spaceId: string) => {
    const membership = isUuid(spaceId) ? await spaces.findMembership(spaceId, userId) : undefined;
    if (!membership || !canManageMembers(membership.role)) {
      throw new AuthError(403, "only an owner or admin can do this");
    }
  };

  const find = async (token: string) => {
    const target = TOKEN.test(token) ? await invites.findByHash(hashToken(token)) : undefined;
    if (!target) throw new AuthError(400, "this invite link is not valid any more");
    return target;
  };

  return {
    async create(userId, spaceId, options) {
      await requireManager(userId, spaceId);
      if ((await invites.countActive(spaceId)) >= MAX_ACTIVE_INVITES) {
        throw new AuthError(409, "too many active links; revoke one first");
      }
      const token = randomBytes(32).toString("base64url");
      const invite = await invites.create({
        spaceId,
        tokenHash: hashToken(token),
        requiresApproval: options.requiresApproval,
        expiresInHours: options.expiresInHours,
        createdBy: userId,
      });
      return { ...invite, token };
    },

    async list(userId, spaceId) {
      await requireManager(userId, spaceId);
      return invites.listActive(spaceId);
    },

    async revoke(userId, spaceId, inviteId) {
      await requireManager(userId, spaceId);
      if (!isUuid(inviteId) || !(await invites.revoke(spaceId, inviteId))) {
        throw new AuthError(400, "that link is already gone");
      }
    },

    async preview(userId, token) {
      const target = await find(token);
      return {
        spaceName: target.spaceName,
        requiresApproval: target.requiresApproval,
        alreadyMember: !!(await spaces.findMembership(target.spaceId, userId)),
      };
    },

    async accept(userId, token) {
      const target = await find(token);
      const existing = await spaces.findSummary(target.spaceId, userId);
      if (existing) return { status: "joined", space: existing };
      if (target.requiresApproval) {
        await invites.requestJoin(target.spaceId, userId);
        return { status: "pending", spaceName: target.spaceName };
      }
      await spaces.addMember(target.spaceId, userId);
      const space = await spaces.findSummary(target.spaceId, userId);
      if (!space) throw new AuthError(400, "this invite link is not valid any more");
      return { status: "joined", space };
    },

    async requests(userId, spaceId) {
      await requireManager(userId, spaceId);
      return invites.listRequests(spaceId);
    },

    async decide(userId, spaceId, applicantId, approve) {
      await requireManager(userId, spaceId);
      if (!isUuid(applicantId) || !(await invites.decide(spaceId, applicantId, approve))) {
        throw new AuthError(400, "that request was already handled");
      }
    },
  };
}
