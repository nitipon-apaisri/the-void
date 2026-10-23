// lib
import express, { type Application, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";

// shared
import { SPACE_ROUTES, type ApiError } from "@void/shared";

import { allowOrigins } from "../common/cors.js";
import { parseSpace } from "../common/credentials.js";
import { AuthError, type AuthService } from "../services/auth.service.js";
import type { SpaceService } from "../services/space.service.js";

interface Options {
  auth: AuthService;
  spaces: SpaceService;
  corsOrigins: readonly string[];
}

const BODY_LIMIT = "1kb";

const bearer = (req: Request) => req.header("authorization")?.match(/^Bearer (.+)$/)?.[1];

/** Mounts the space endpoints. Every one needs a valid token; membership is checked per space. */
export function mountSpaceRoutes(app: Application, { auth, spaces, corsOrigins }: Options) {
  app.use(SPACE_ROUTES.LIST, allowOrigins(corsOrigins));

  const createLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "too many spaces created, try again later" } satisfies ApiError,
  });

  const respond = async (
    req: Request,
    res: Response,
    work: (userId: string) => Promise<unknown>,
  ) => {
    try {
      const user = await auth.authenticate(bearer(req));
      if (!user) throw new AuthError(401, "not signed in");
      res.json(await work(user.id));
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message } satisfies ApiError);
        return;
      }
      console.error("space request failed", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "something went wrong" } satisfies ApiError);
    }
  };

  app.get(SPACE_ROUTES.LIST, (req, res) => respond(req, res, (id) => spaces.listMine(id)));

  app.post(SPACE_ROUTES.LIST, createLimiter, express.json({ limit: BODY_LIMIT }), (req, res) =>
    respond(req, res, async (id) => {
      const parsed = parseSpace(req.body);
      if (!parsed.ok) throw new AuthError(400, parsed.error);
      return spaces.create(id, parsed.value);
    }),
  );

  app.get(`${SPACE_ROUTES.PREFIX}:spaceId/members`, (req, res) =>
    respond(req, res, (id) => spaces.members(id, String(req.params.spaceId))),
  );
}
