// lib
import express, { type Application, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";

// shared
import { AUTH_ROUTES, type ApiError } from "@void/shared";

import { parseLogin, parseRegistration, type Parsed } from "../common/credentials.js";
import { AuthError, type AuthService } from "../services/auth.service.js";

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

  // Tokens travel in the Authorization header, not cookies, so CORS is the only browser gate.
  app.use("/auth", (req, res, next) => {
    const origin = req.header("origin");
    if (origin && corsOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  const limiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: MAX_ATTEMPTS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "too many attempts, try again later" } satisfies ApiError,
  });
  const json = express.json({ limit: BODY_LIMIT });

  const handle =
    <T>(parse: (body: unknown) => Parsed<T>, run: (value: T) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      const parsed = parse(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error } satisfies ApiError);
        return;
      }
      try {
        res.json(await run(parsed.value));
      } catch (err) {
        if (err instanceof AuthError) {
          res.status(err.status).json({ error: err.message } satisfies ApiError);
          return;
        }
        console.error("auth request failed", err instanceof Error ? err.message : err);
        res.status(500).json({ error: "something went wrong" } satisfies ApiError);
      }
    };

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

  app.get(AUTH_ROUTES.ME, async (req, res) => {
    const user = await auth.authenticate(bearer(req));
    if (!user) {
      res.status(401).json({ error: "not signed in" } satisfies ApiError);
      return;
    }
    res.json({ id: user.id, name: user.name, avatar: user.avatar });
  });
}
