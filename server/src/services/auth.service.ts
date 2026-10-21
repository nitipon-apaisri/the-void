// shared
import type { AuthSession, LoginPayload, RegisterPayload, UserProfile } from "@void/shared";

import type { UserRecord, UserRepository } from "../repositories/user.repository.js";
import type { PasswordService } from "./password.service.js";
import type { TokenService } from "./token.service.js";

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 409,
    message: string,
  ) {
    super(message);
  }
}

export interface AuthService {
  register(payload: RegisterPayload): Promise<AuthSession>;
  login(payload: LoginPayload): Promise<AuthSession>;
  /** The account behind a token, or undefined if the token is bad or the account is gone. */
  authenticate(token: unknown): Promise<UserRecord | undefined>;
}

const toProfile = (user: UserRecord): UserProfile => ({
  id: user.id,
  name: user.name,
  avatar: user.avatar,
});

interface Deps {
  users: UserRepository;
  passwords: PasswordService;
  tokens: TokenService;
}

export function createAuthService({ users, passwords, tokens }: Deps): AuthService {
  const session = async (user: UserRecord): Promise<AuthSession> => ({
    token: await tokens.issue(user.id),
    user: toProfile(user),
  });

  // Verified against when the email is unknown, so a miss costs as much as a wrong password.
  const decoyHash = passwords.hash("decoy-password-never-matches");

  return {
    async register({ email, password, name, avatar }) {
      const user = await users.create({
        email,
        passwordHash: await passwords.hash(password),
        name,
        avatar,
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
      const id = await tokens.verify(token);
      return id ? users.findById(id) : undefined;
    },
  };
}
