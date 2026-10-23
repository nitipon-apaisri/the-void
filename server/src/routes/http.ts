// lib
import type { Request, Response } from "express";

// shared
import type { ApiError } from "@void/shared";

import { AuthError, type AuthService } from "../services/auth.service.js";

const bearer = (req: Request) => req.header("authorization")?.match(/^Bearer (.+)$/)?.[1];

/**
 * Runs `work` for the signed-in account and sends its result as JSON. The token is checked
 * first, so an anonymous caller learns nothing about the route. Errors that are meant for the
 * person become a message; anything else is logged without detail and answered generically.
 */
export async function respondAs(
  auth: AuthService,
  req: Request,
  res: Response,
  work: (userId: string) => Promise<unknown>,
) {
  try {
    const user = await auth.authenticate(bearer(req));
    if (!user) throw new AuthError(401, "not signed in");
    res.json(await work(user.id));
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message } satisfies ApiError);
      return;
    }
    console.error("request failed", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "something went wrong" } satisfies ApiError);
  }
}
