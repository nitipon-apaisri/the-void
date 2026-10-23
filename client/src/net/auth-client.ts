// shared
import {
  AUTH_ROUTES,
  type ApiError,
  type AuthSession,
  type ChangeEmailPayload,
  type ChangePasswordPayload,
  type DeleteAccountPayload,
  type LoginPayload,
  type RegisterPayload,
  type UpdateProfilePayload,
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
  updateProfile(token: string, payload: UpdateProfilePayload): Promise<UserProfile>;
  changeEmail(token: string, payload: ChangeEmailPayload): Promise<UserProfile>;
  /** Other devices are signed out; the returned session replaces this device's token. */
  changePassword(token: string, payload: ChangePasswordPayload): Promise<AuthSession>;
  signOutOthers(token: string): Promise<AuthSession>;
  deleteAccount(token: string, payload: DeleteAccountPayload): Promise<void>;
}

export function createAuthClient(baseUrl: string): AuthClient {
  async function send<T>(
    path: string,
    method: string,
    token?: string,
    payload?: unknown,
  ): Promise<{ status: number; body: T | ApiError }> {
    const headers: Record<string, string> = {};
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    // A proxy error page is not JSON; treat it as a plain failure.
    const body = (await res.json().catch(() => ({ error: "unexpected response" }))) as T | ApiError;
    return { status: res.status, body };
  }

  async function call<T>(path: string, method: string, token?: string, payload?: unknown) {
    const { status, body } = await send<T>(path, method, token, payload);
    if (status !== 200) {
      throw new AuthRequestError(status, (body as ApiError).error ?? "request failed");
    }
    return body as T;
  }

  return {
    register: (payload) => call(AUTH_ROUTES.REGISTER, "POST", undefined, payload),
    login: (payload) => call(AUTH_ROUTES.LOGIN, "POST", undefined, payload),
    async me(token) {
      const { status, body } = await send<UserProfile>(AUTH_ROUTES.ME, "GET", token);
      if (status === 401) return undefined;
      if (status !== 200) throw new AuthRequestError(status, "request failed");
      return body as UserProfile;
    },
    updateProfile: (token, payload) => call(AUTH_ROUTES.ME, "PATCH", token, payload),
    changeEmail: (token, payload) => call(AUTH_ROUTES.EMAIL, "POST", token, payload),
    changePassword: (token, payload) => call(AUTH_ROUTES.PASSWORD, "POST", token, payload),
    signOutOthers: (token) => call(AUTH_ROUTES.SIGN_OUT_OTHERS, "POST", token),
    async deleteAccount(token, payload) {
      await call(AUTH_ROUTES.ME, "DELETE", token, payload);
    },
  };
}
