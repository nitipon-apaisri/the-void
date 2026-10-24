// shared
import type {
  AuthSession,
  ChangeEmailPayload,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  UserProfile,
} from "@void/shared";

import type { UserRecord, UserRepository } from "../repositories/user.repository.js";
import type { SpaceRepository } from "../repositories/space.repository.js";
import type { PasswordService } from "./password.service.js";
import type { TokenService } from "./token.service.js";

export class AuthError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 409,
    message: string,
  ) {
    super(message);
  }
}

export interface AuthService {
  register(payload: RegisterPayload): Promise<AuthSession>;
  login(payload: LoginPayload): Promise<AuthSession>;
  /** The account behind a token, or undefined if the token is bad, stale or the account is gone. */
  authenticate(token: unknown): Promise<UserRecord | undefined>;
  updateProfile(user: UserRecord, payload: UpdateProfilePayload): Promise<UserProfile>;
  changeEmail(user: UserRecord, payload: ChangeEmailPayload): Promise<UserProfile>;
  /** Signs every other device out and returns a fresh session for this one. */
  changePassword(user: UserRecord, payload: ChangePasswordPayload): Promise<AuthSession>;
  signOutOthers(user: UserRecord): Promise<AuthSession>;
  deleteAccount(user: UserRecord, password: string): Promise<void>;
}

export const toProfile = (user: UserRecord): UserProfile => ({
  id: user.id,
  email: user.email,
  name: user.name,
  look: user.look,
});

interface Deps {
  users: UserRepository;
  /** Only what closing an account needs from the spaces. */
  spaces: Pick<SpaceRepository, "handOverOwned">;
  passwords: PasswordService;
  tokens: TokenService;
}

export function createAuthService({ users, spaces, passwords, tokens }: Deps): AuthService {
  const session = async (user: UserRecord): Promise<AuthSession> => ({
    token: await tokens.issue(user.id, user.tokenVersion),
    user: toProfile(user),
  });

  // Verified against when the email is unknown, so a miss costs as much as a wrong password.
  const decoyHash = passwords.hash("decoy-password-never-matches");

  // Edits that change what the account is protected by must prove the password again, so a
  // stolen token alone cannot take the account over. 403, not 401: the token itself is fine.
  const requirePassword = async (user: UserRecord, password: string) => {
    if (!(await passwords.verify(password, user.passwordHash))) {
      throw new AuthError(403, "current password is incorrect");
    }
  };

  const gone = () => new AuthError(401, "not signed in");

  return {
    async register({ email, password, name, look }) {
      const user = await users.create({
        email,
        passwordHash: await passwords.hash(password),
        name,
        look,
      });
      if (!user) throw new AuthError(409, "an account with this email already exists");
      return session(user);
    },

    async login({ email, password }) {
      const user = await users.findByEmail(email);
      const ok = await passwords.verify(password, user?.passwordHash ?? (await decoyHash));
      // One message for both failures, so the response never says which emails exist.
      if (!user || !ok) throw new AuthError(401, "invalid email or password");
      return session(user);
    },

    async authenticate(token) {
      const claims = await tokens.verify(token);
      if (!claims) return undefined;
      const user = await users.findById(claims.userId);
      return user && user.tokenVersion === claims.version ? user : undefined;
    },

    async updateProfile(user, { name, look }) {
      const updated = await users.updateProfile(user.id, name, look);
      if (!updated) throw gone();
      return toProfile(updated);
    },

    async changeEmail(user, { currentPassword, email }) {
      await requirePassword(user, currentPassword);
      const updated = await users.updateEmail(user.id, email);
      if (!updated) throw new AuthError(409, "an account with this email already exists");
      return toProfile(updated);
    },

    async changePassword(user, { currentPassword, newPassword }) {
      await requirePassword(user, currentPassword);
      const updated = await users.updatePassword(user.id, await passwords.hash(newPassword));
      if (!updated) throw gone();
      return session(updated);
    },

    async signOutOthers(user) {
      const updated = await users.bumpTokenVersion(user.id);
      if (!updated) throw gone();
      return session(updated);
    },

    async deleteAccount(user, password) {
      await requirePassword(user, password);
      // Before the account goes, so a space it owns is never left without an owner.
      await spaces.handOverOwned(user.id);
      await users.remove(user.id);
    },
  };
}
