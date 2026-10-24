// shared
import {
  INVITE_ROUTES,
  SPACE_ROUTES,
  type ApiError,
  type CreateSpacePayload,
  type CreatedInvite,
  type InviteOptions,
  type InvitePreview,
  type InviteResult,
  type InviteSummary,
  type JoinRequest,
  type SpaceMember,
  type SpaceRole,
  type SpaceSummary,
} from "@void/shared";

// net
import { AuthRequestError } from "./auth-client";

export interface SpaceClient {
  list(token: string): Promise<SpaceSummary[]>;
  create(token: string, payload: CreateSpacePayload): Promise<SpaceSummary>;
  members(token: string, spaceId: string): Promise<SpaceMember[]>;
  // Owners and admins.
  createInvite(token: string, spaceId: string, options: InviteOptions): Promise<CreatedInvite>;
  listInvites(token: string, spaceId: string): Promise<InviteSummary[]>;
  revokeInvite(token: string, spaceId: string, inviteId: string): Promise<void>;
  listRequests(token: string, spaceId: string): Promise<JoinRequest[]>;
  decideRequest(token: string, spaceId: string, userId: string, approve: boolean): Promise<void>;
  // Owners hand roles out; owners and admins remove people; anyone may remove themselves (leave).
  setRole(token: string, spaceId: string, userId: string, role: SpaceRole): Promise<void>;
  removeMember(token: string, spaceId: string, userId: string): Promise<void>;
  // Anyone signed in who holds a link.
  previewInvite(token: string, invite: string): Promise<InvitePreview>;
  acceptInvite(token: string, invite: string): Promise<InviteResult>;
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

  const spacePath = (spaceId: string, rest: string) =>
    `${SPACE_ROUTES.PREFIX}${encodeURIComponent(spaceId)}${rest}`;
  const invitePath = (invite: string, rest = "") =>
    `${INVITE_ROUTES.PREFIX}${encodeURIComponent(invite)}${rest}`;

  return {
    list: (token) => call(SPACE_ROUTES.LIST, "GET", token),
    create: (token, payload) => call(SPACE_ROUTES.LIST, "POST", token, payload),
    members: (token, spaceId) => call(spacePath(spaceId, "/members"), "GET", token),
    createInvite: (token, spaceId, options) =>
      call(spacePath(spaceId, "/invites"), "POST", token, options),
    listInvites: (token, spaceId) => call(spacePath(spaceId, "/invites"), "GET", token),
    async revokeInvite(token, spaceId, inviteId) {
      await call(spacePath(spaceId, `/invites/${encodeURIComponent(inviteId)}`), "DELETE", token);
    },
    listRequests: (token, spaceId) => call(spacePath(spaceId, "/requests"), "GET", token),
    async decideRequest(token, spaceId, userId, approve) {
      const action = approve ? "approve" : "deny";
      await call(
        spacePath(spaceId, `/requests/${encodeURIComponent(userId)}/${action}`),
        "POST",
        token,
      );
    },
    async setRole(token, spaceId, userId, role) {
      await call(spacePath(spaceId, `/members/${encodeURIComponent(userId)}`), "PATCH", token, {
        role,
      });
    },
    async removeMember(token, spaceId, userId) {
      await call(spacePath(spaceId, `/members/${encodeURIComponent(userId)}`), "DELETE", token);
    },
    previewInvite: (token, invite) => call(invitePath(invite), "GET", token),
    acceptInvite: (token, invite) => call(invitePath(invite, "/accept"), "POST", token),
  };
}
