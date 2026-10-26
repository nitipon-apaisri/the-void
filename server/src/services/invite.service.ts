// lib
import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

// shared
import {
  canManageMembers,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  MAX_ACTIVE_INVITES,
  normalizeInviteCode,
  type CreatedInvite,
  type InviteOptions,
  type InvitePreview,
  type InviteResult,
  type InviteSummary,
  type JoinRequest,
} from "@void/shared";

import type { BanRepository } from "../repositories/ban.repository.js";
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

/**
 * A code has about 49 bits against a token's 256, so a plain hash would not survive a leaked
 * database: it is keyed with a server secret instead.
 */
export const hashCode = (secret: string, code: string) =>
  createHmac("sha256", secret).update(code).digest("hex");

export const newCode = () =>
  Array.from({ length: INVITE_CODE_LENGTH }, () =>
    INVITE_CODE_ALPHABET.charAt(randomInt(INVITE_CODE_ALPHABET.length)),
  ).join("");

// A real token is 43 base64url characters; anything else cannot match, so skip the query.
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export function createInviteService(
  invites: InviteRepository,
  spaces: SpaceRepository,
  bans: BanRepository,
  /** Keys the hash of join codes (the server's AUTH_SECRET). */
  secret: string,
): InviteService {
  // Same answer for a space that does not exist and one you may not manage.
  const requireManager = async (userId: string, spaceId: string) => {
    const membership = isUuid(spaceId) ? await spaces.findMembership(spaceId, userId) : undefined;
    if (!membership || !canManageMembers(membership.role)) {
      throw new AuthError(403, "only an owner or admin can do this");
    }
  };

  // A link token or a join code, whichever was typed or opened.
  const find = async (input: string, userId: string) => {
    const code = normalizeInviteCode(input);
    const target = code
      ? await invites.findByCodeHash(hashCode(secret, code))
      : TOKEN.test(input)
        ? await invites.findByHash(hashToken(input))
        : undefined;
    // The same answer as for a dead link, so a ban does not announce itself.
    if (!target || (await bans.isBanned(target.spaceId, userId))) {
      throw new AuthError(400, "this invite link or code is not valid any more");
    }
    return target;
  };

  return {
    async create(userId, spaceId, options) {
      await requireManager(userId, spaceId);
      if ((await invites.countActive(spaceId)) >= MAX_ACTIVE_INVITES) {
        throw new AuthError(409, "too many active links; revoke one first");
      }
      const token = randomBytes(32).toString("base64url");
      const code = newCode();
      const invite = await invites.create({
        spaceId,
        tokenHash: hashToken(token),
        codeHash: hashCode(secret, code),
        requiresApproval: options.requiresApproval,
        expiresInHours: options.expiresInHours,
        createdBy: userId,
      });
      return { ...invite, token, code };
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
      const target = await find(token, userId);
      return {
        spaceName: target.spaceName,
        requiresApproval: target.requiresApproval,
        alreadyMember: !!(await spaces.findMembership(target.spaceId, userId)),
      };
    },

    async accept(userId, token) {
      const target = await find(token, userId);
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
