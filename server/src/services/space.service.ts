// shared
import {
  MAX_OWNED_SPACES,
  type CreateSpacePayload,
  type SpaceMember,
  type SpaceSummary,
} from "@void/shared";

import type { SpaceRepository } from "../repositories/space.repository.js";
import { isUuid } from "../repositories/space.repository.js";
import { AuthError } from "./auth.service.js";

export interface SpaceService {
  create(userId: string, payload: CreateSpacePayload): Promise<SpaceSummary>;
  listMine(userId: string): Promise<SpaceSummary[]>;
  /** Only members may see who else is in a space. */
  members(userId: string, spaceId: string): Promise<SpaceMember[]>;
}

export function createSpaceService(spaces: SpaceRepository): SpaceService {
  return {
    async create(userId, { name }) {
      if ((await spaces.countOwned(userId)) >= MAX_OWNED_SPACES) {
        throw new AuthError(409, `you can own at most ${MAX_OWNED_SPACES} spaces`);
      }
      return spaces.create(name, userId);
    },

    listMine: (userId) => spaces.listForUser(userId),

    async members(userId, spaceId) {
      // The same answer for a space that does not exist and one you are not in.
      if (!isUuid(spaceId) || !(await spaces.findMembership(spaceId, userId))) {
        throw new AuthError(403, "you are not in this space");
      }
      return spaces.listMembers(spaceId);
    },
  };
}
