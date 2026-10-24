// lib
import express, { type Application } from "express";
import { rateLimit } from "express-rate-limit";

// shared
import { SPACE_ROUTES, type ApiError } from "@void/shared";

import { allowOrigins } from "../common/cors.js";
import { parseInviteOptions, parseRoleChange, parseSpace } from "../common/credentials.js";
import { AuthError, type AuthService } from "../services/auth.service.js";
import type { InviteService } from "../services/invite.service.js";
import type { MemberService } from "../services/member.service.js";
import type { SpaceService } from "../services/space.service.js";
import { respondAs } from "./http.js";

interface Options {
  auth: AuthService;
  spaces: SpaceService;
  invites: InviteService;
  members: MemberService;
  corsOrigins: readonly string[];
}

const BODY_LIMIT = "1kb";

/** Mounts the space endpoints. Every one needs a valid token; membership is checked per space. */
export function mountSpaceRoutes(
  app: Application,
  { auth, spaces, invites, members, corsOrigins }: Options,
) {
  app.use(SPACE_ROUTES.LIST, allowOrigins(corsOrigins));

  const limiter = (limit: number, message: string) =>
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: message } satisfies ApiError,
    });
  const createLimiter = limiter(20, "too many spaces created, try again later");
  const inviteLimiter = limiter(60, "too many links created, try again later");
  const json = express.json({ limit: BODY_LIMIT });
  const space = (path: string) => `${SPACE_ROUTES.PREFIX}:spaceId${path}`;

  app.get(SPACE_ROUTES.LIST, (req, res) => respondAs(auth, req, res, (id) => spaces.listMine(id)));

  app.post(SPACE_ROUTES.LIST, createLimiter, json, (req, res) =>
    respondAs(auth, req, res, async (id) => {
      const parsed = parseSpace(req.body);
      if (!parsed.ok) throw new AuthError(400, parsed.error);
      return spaces.create(id, parsed.value);
    }),
  );

  app.get(space("/members"), (req, res) =>
    respondAs(auth, req, res, (id) => spaces.members(id, String(req.params.spaceId))),
  );

  app.patch(space("/members/:userId"), json, (req, res) =>
    respondAs(auth, req, res, async (id) => {
      const parsed = parseRoleChange(req.body);
      if (!parsed.ok) throw new AuthError(400, parsed.error);
      await members.setRole(
        id,
        String(req.params.spaceId),
        String(req.params.userId),
        parsed.value.role,
      );
      return {};
    }),
  );

  // Removing yourself is leaving the space.
  app.delete(space("/members/:userId"), (req, res) =>
    respondAs(auth, req, res, async (id) => {
      await members.remove(id, String(req.params.spaceId), String(req.params.userId));
      return {};
    }),
  );

  app.get(space("/bans"), (req, res) =>
    respondAs(auth, req, res, (id) => members.bans(id, String(req.params.spaceId))),
  );

  app.put(space("/bans/:userId"), (req, res) =>
    respondAs(auth, req, res, async (id) => {
      await members.ban(id, String(req.params.spaceId), String(req.params.userId));
      return {};
    }),
  );

  app.delete(space("/bans/:userId"), (req, res) =>
    respondAs(auth, req, res, async (id) => {
      await members.unban(id, String(req.params.spaceId), String(req.params.userId));
      return {};
    }),
  );

  app.get(space("/invites"), (req, res) =>
    respondAs(auth, req, res, (id) => invites.list(id, String(req.params.spaceId))),
  );

  app.post(space("/invites"), inviteLimiter, json, (req, res) =>
    respondAs(auth, req, res, async (id) => {
      const parsed = parseInviteOptions(req.body);
      if (!parsed.ok) throw new AuthError(400, parsed.error);
      return invites.create(id, String(req.params.spaceId), parsed.value);
    }),
  );

  app.delete(space("/invites/:inviteId"), (req, res) =>
    respondAs(auth, req, res, async (id) => {
      await invites.revoke(id, String(req.params.spaceId), String(req.params.inviteId));
      return {};
    }),
  );

  app.get(space("/requests"), (req, res) =>
    respondAs(auth, req, res, (id) => invites.requests(id, String(req.params.spaceId))),
  );

  for (const [action, approve] of [
    ["approve", true],
    ["deny", false],
  ] as const) {
    app.post(space(`/requests/:userId/${action}`), (req, res) =>
      respondAs(auth, req, res, async (id) => {
        await invites.decide(id, String(req.params.spaceId), String(req.params.userId), approve);
        return {};
      }),
    );
  }
}
