// lib
import { matchMaker } from "@colyseus/core";
import type { RequestHandler } from "express";

/**
 * Colyseus answers CORS for every route and reflects whatever origin asks, which would
 * defeat an allowlist. Replace that with ours; a disallowed origin gets an origin that
 * cannot match, so the browser refuses the response.
 */
export function restrictCors(allowed: readonly string[]) {
  matchMaker.controller.getCorsHeaders = (headers) => {
    const origin = headers.get("origin");
    return {
      "Access-Control-Allow-Origin": origin && allowed.includes(origin) ? origin : "null",
      Vary: "Origin",
    };
  };
}

/**
 * CORS for our own HTTP routes. Tokens travel in the Authorization header, not cookies, so this
 * allowlist is the only browser-side gate.
 */
export function allowOrigins(allowed: readonly string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.header("origin");
    if (origin && allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
