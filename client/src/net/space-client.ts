// shared
import {
  SPACE_ROUTES,
  type ApiError,
  type CreateSpacePayload,
  type SpaceMember,
  type SpaceSummary,
} from "@void/shared";

// net
import { AuthRequestError } from "./auth-client";

export interface SpaceClient {
  list(token: string): Promise<SpaceSummary[]>;
  create(token: string, payload: CreateSpacePayload): Promise<SpaceSummary>;
  members(token: string, spaceId: string): Promise<SpaceMember[]>;
}

export function createSpaceClient(baseUrl: string): SpaceClient {
  async function call<T>(path: string, method: string, token: string, payload?: unknown) {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    // A proxy error page is not JSON; treat it as a plain failure.
    const body = (await res.json().catch(() => ({ error: "unexpected response" }))) as T | ApiError;
    if (res.status !== 200) {
      throw new AuthRequestError(res.status, (body as ApiError).error ?? "request failed");
    }
    return body as T;
  }

  return {
    list: (token) => call(SPACE_ROUTES.LIST, "GET", token),
    create: (token, payload) => call(SPACE_ROUTES.LIST, "POST", token, payload),
    members: (token, spaceId) =>
      call(`${SPACE_ROUTES.PREFIX}${encodeURIComponent(spaceId)}/members`, "GET", token),
  };
}
