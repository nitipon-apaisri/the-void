// lib
import { matchMaker } from "@colyseus/core";

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
