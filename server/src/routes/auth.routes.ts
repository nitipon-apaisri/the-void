// lib
import express, { type Application, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";

// shared
import { AUTH_ROUTES, type ApiError } from "@void/shared";

import { allowOrigins } from "../common/cors.js";
import {
  parseDeletion,
  parseEmailChange,
  parseLogin,
  parsePasswordChange,
  parseProfile,
  parseRegistration,
  type Parsed,
} from "../common/credentials.js";
import type { UserRecord } from "../repositories/user.repository.js";
import { AuthError, toProfile, type AuthService } from "../services/auth.service.js";

interface Options {
  auth: AuthService;
  corsOrigins: readonly string[];
  trustProxyHops: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
// A credentials body is a few hundred bytes; reject anything bigger before parsing it.
const BODY_LIMIT = "2kb";

const bearer = (req: Request) => req.header("authorization")?.match(/^Bearer (.+)$/)?.[1];

/** Mounts the account endpoints. Nothing here logs request bodies or tokens. */
export function mountAuthRoutes(app: Application, { auth, corsOrigins, trustProxyHops }: Options) {
  app.set("trust proxy", trustProxyHops);

  app.use("/auth", allowOrigins(corsOrigins));

  const limiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: MAX_ATTEMPTS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "too many attempts, try again later" } satisfies ApiError,
  });
  const json = express.json({ limit: BODY_LIMIT });

  const respond = async (res: Response, work: () => Promise<unknown>) => {
    try {
      res.json(await work());
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message } satisfies ApiError);
        return;
      }
      console.error("auth request failed", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "something went wrong" } satisfies ApiError);
    }
  };

  const parseOrFail = <T>(parse: (body: unknown) => Parsed<T>, body: unknown): T => {
    const parsed = parse(body);
    if (!parsed.ok) throw new AuthError(400, parsed.error);
    return parsed.value;
  };

  const handle =
    <T>(parse: (body: unknown) => Parsed<T>, run: (value: T) => Promise<unknown>) =>
    (req: Request, res: Response) =>
      respond(res, () => run(parseOrFail(parse, req.body)));

  // The token is checked before the body, so an anonymous caller learns nothing about the shape.
  const handleAuthed =
    <T>(
      parse: (body: unknown) => Parsed<T>,
      run: (value: T, user: UserRecord) => Promise<unknown>,
    ) =>
    (req: Request, res: Response) =>
      respond(res, async () => {
        const user = await auth.authenticate(bearer(req));
        if (!user) throw new AuthError(401, "not signed in");
        return run(parseOrFail(parse, req.body), user);
      });

  const anyBody = (): Parsed<null> => ({ ok: true, value: null });

  app.post(
    AUTH_ROUTES.REGISTER,
    limiter,
    json,
    handle(parseRegistration, (v) => auth.register(v)),
  );
  app.post(
    AUTH_ROUTES.LOGIN,
    limiter,
    json,
    handle(parseLogin, (v) => auth.login(v)),
  );

  // Not rate limited: the client calls it on every start, and it cannot guess a password.
  app.get(
    AUTH_ROUTES.ME,
    handleAuthed(anyBody, async (_, user) => toProfile(user)),
  );
  app.patch(
    AUTH_ROUTES.ME,
    limiter,
    json,
    handleAuthed(parseProfile, (v, user) => auth.updateProfile(user, v)),
  );
  app.delete(
    AUTH_ROUTES.ME,
    limiter,
    json,
    handleAuthed(parseDeletion, async (v, user) => {
      await auth.deleteAccount(user, v.password);
      return {};
    }),
  );
  app.post(
    AUTH_ROUTES.EMAIL,
    limiter,
    json,
    handleAuthed(parseEmailChange, (v, user) => auth.changeEmail(user, v)),
  );
  app.post(
    AUTH_ROUTES.PASSWORD,
    limiter,
    json,
    handleAuthed(parsePasswordChange, (v, user) => auth.changePassword(user, v)),
  );
  app.post(
    AUTH_ROUTES.SIGN_OUT_OTHERS,
    limiter,
    handleAuthed(anyBody, (_, user) => auth.signOutOthers(user)),
  );
}
