// lib
import type { Application } from "express";
import { rateLimit } from "express-rate-limit";

// shared
import { INVITE_ROUTES, type ApiError } from "@void/shared";

import { allowOrigins } from "../common/cors.js";
import type { AuthService } from "../services/auth.service.js";
import type { InviteService } from "../services/invite.service.js";
import { respondAs } from "./http.js";

interface Options {
  auth: AuthService;
  invites: InviteService;
  corsOrigins: readonly string[];
}

/** Using an invite link or code: look at it, then accept it. The token or code in the path is the secret. */
export function mountInviteRoutes(app: Application, { auth, invites, corsOrigins }: Options) {
  app.use(INVITE_ROUTES.PREFIX, allowOrigins(corsOrigins));

  // A token is 256 random bits, so guessing is hopeless; the limit just keeps probing cheap to refuse.
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "too many attempts, try again later" } satisfies ApiError,
  });

  // A join code is far shorter than a token, so failures (not successes) count against a
  // tighter limit per address.
  const failures = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "too many wrong codes, try again later" } satisfies ApiError,
  });

  app.get(`${INVITE_ROUTES.PREFIX}:token`, limiter, failures, (req, res) =>
    respondAs(auth, req, res, (id) => invites.preview(id, String(req.params.token))),
  );
  app.post(`${INVITE_ROUTES.PREFIX}:token/accept`, limiter, failures, (req, res) =>
    respondAs(auth, req, res, (id) => invites.accept(id, String(req.params.token))),
  );
}
