// shared
import {
  canManageLinks,
  canManagePortals,
  MAX_LINKS,
  normalizeInviteCode,
  type ConnectCode,
  type SpaceLink,
} from "@void/shared";

import type { LinkRepository } from "../repositories/link.repository.js";
import { isUuid, type SpaceRepository } from "../repositories/space.repository.js";
import { AuthError } from "./auth.service.js";
import { hashCode, newCode } from "./invite.service.js";

export interface LinkService {
  /** The owner makes a new code (shown once); the old one stops working. */
  connectCode(userId: string, spaceId: string): Promise<ConnectCode>;
  /** Owners and admins. */
  list(userId: string, spaceId: string): Promise<SpaceLink[]>;
  /** The owner of `spaceId` asks the owner of the space behind `code` for a link. */
  request(userId: string, spaceId: string, code: string): Promise<SpaceLink[]>;
  /** The owner of the space that was asked. */
  approve(userId: string, spaceId: string, linkId: string): Promise<void>;
  /** Either owner, to end a link or decline a request. */
  end(userId: string, spaceId: string, linkId: string): Promise<void>;
}

interface Deps {
  links: LinkRepository;
  spaces: SpaceRepository;
  /** Keys the hash of connect codes (the server's AUTH_SECRET). */
  secret: string;
}

export function createLinkService({ links, spaces, secret }: Deps): LinkService {
  // Same answer for a space that does not exist and one you may not manage.
  const requireManager = async (userId: string, spaceId: string) => {
    const membership = isUuid(spaceId) ? await spaces.findMembership(spaceId, userId) : undefined;
    if (!membership || !canManagePortals(membership.role)) {
      throw new AuthError(403, "only an owner or admin can do this");
    }
  };

  const requireOwner = async (userId: string, spaceId: string) => {
    const membership = isUuid(spaceId) ? await spaces.findMembership(spaceId, userId) : undefined;
    if (!membership || !canManageLinks(membership.role)) {
      throw new AuthError(403, "only the owner can do this");
    }
  };

  return {
    async connectCode(userId, spaceId) {
      await requireOwner(userId, spaceId);
      const code = newCode();
      await links.setConnectCode(spaceId, hashCode(secret, code));
      return { code };
    },

    // Admins read the list too: they place the portals.
    async list(userId, spaceId) {
      await requireManager(userId, spaceId);
      return links.list(spaceId);
    },

    async request(userId, spaceId, input) {
      await requireOwner(userId, spaceId);
      const code = normalizeInviteCode(input);
      const target = code ? await links.findByConnectCode(hashCode(secret, code)) : undefined;
      if (!target) throw new AuthError(400, "that connect code is not valid any more");
      if (target.id === spaceId) throw new AuthError(400, "that is this space's own code");
      if (
        (await links.countLive(spaceId)) >= MAX_LINKS ||
        (await links.countLive(target.id)) >= MAX_LINKS
      ) {
        throw new AuthError(409, "too many links; end one first");
      }
      if (!(await links.request(spaceId, target.id, userId))) {
        throw new AuthError(409, "these spaces are already linked or waiting for an answer");
      }
      return links.list(spaceId);
    },

    async approve(userId, spaceId, linkId) {
      await requireOwner(userId, spaceId);
      if (!isUuid(linkId) || !(await links.approve(spaceId, linkId, userId))) {
        throw new AuthError(400, "that request was already handled");
      }
    },

    async end(userId, spaceId, linkId) {
      await requireOwner(userId, spaceId);
      if (!isUuid(linkId) || !(await links.end(spaceId, linkId))) {
        throw new AuthError(400, "that link is already gone");
      }
    },
  };
}
