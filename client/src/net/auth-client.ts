// shared
import {
  AUTH_ROUTES,
  type ApiError,
  type AuthSession,
  type LoginPayload,
  type RegisterPayload,
  type UserProfile,
} from "@void/shared";

/** The server refused the request; `message` is safe to show to the person. */
export class AuthRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface AuthClient {
  register(payload: RegisterPayload): Promise<AuthSession>;
  login(payload: LoginPayload): Promise<AuthSession>;
  /** The profile behind a token, or undefined if it was rejected. Throws if the server is unreachable. */
  me(token: string): Promise<UserProfile | undefined>;
}

export function createAuthClient(baseUrl: string): AuthClient {
  async function send<T>(path: string, init: RequestInit): Promise<{ status: number; body: T }> {
    const res = await fetch(`${baseUrl}${path}`, init);
    // A proxy error page is not JSON; treat it as a plain failure.
    const body = (await res.json().catch(() => ({ error: "unexpected response" }))) as T;
    return { status: res.status, body };
  }

  async function post(path: string, payload: unknown): Promise<AuthSession> {
    const { status, body } = await send<AuthSession | ApiError>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (status !== 200) {
      throw new AuthRequestError(status, (body as ApiError).error ?? "request failed");
    }
    return body as AuthSession;
  }

  return {
    register: (payload) => post(AUTH_ROUTES.REGISTER, payload),
    login: (payload) => post(AUTH_ROUTES.LOGIN, payload),
    async me(token) {
      const { status, body } = await send<UserProfile>(AUTH_ROUTES.ME, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (status === 401) return undefined;
      if (status !== 200) throw new AuthRequestError(status, "request failed");
      return body;
    },
  };
}
