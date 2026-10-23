// shared
import {
  AVATAR_COLORS,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type UserProfile,
} from "@void/shared";

// net
import { AuthRequestError } from "../net/auth-client";

/** What the account tab can ask the app to do. Each call throws an Error with a displayable message. */
export interface AccountActions {
  updateProfile(name: string, avatar: number): Promise<UserProfile>;
  changeEmail(email: string, currentPassword: string): Promise<UserProfile>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  signOutOthers(): Promise<void>;
  /** The app signs out and reloads on success, so nothing is shown afterwards. */
  deleteAccount(password: string): Promise<void>;
}

export interface AccountContext {
  profile: UserProfile;
  actions: AccountActions;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

const messageOf = (err: unknown) => {
  if (err instanceof AuthRequestError) return err.message;
  // fetch rejects with a TypeError when the server cannot be reached.
  return err instanceof TypeError ? "Can't reach the server" : "Something went wrong";
};

/** Runs `work` while the button is disabled and reports the result in the section's status line. */
async function run(
  section: HTMLElement,
  button: HTMLButtonElement,
  work: () => Promise<string | void>,
) {
  const status = section.querySelector<HTMLElement>(".status")!;
  button.disabled = true;
  status.textContent = "";
  status.removeAttribute("data-kind");
  try {
    const done = await work();
    status.dataset.kind = "success";
    status.textContent = done ?? "Saved";
  } catch (err) {
    status.dataset.kind = "error";
    status.textContent = messageOf(err);
  } finally {
    button.disabled = false;
  }
}

export function buildAccountTab({ profile, actions }: AccountContext): HTMLElement {
  let current = profile;
  let avatar = profile.avatar;

  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gap = "20px";
  root.innerHTML = `
    <section data-profile>
      <h2>Profile</h2>
      <label>Display name
        <input name="name" maxlength="${MAX_NAME_LENGTH}" autocomplete="nickname" />
      </label>
      <div role="radiogroup" aria-label="Avatar colour" class="swatches"></div>
      <button class="primary" type="button">Save profile</button>
      <p class="status" role="status"></p>
    </section>
    <section data-email>
      <h2>Email</h2>
      <p>Signed in as <strong data-current-email></strong></p>
      <label>New email
        <input name="email" type="email" autocomplete="email" maxlength="254" />
      </label>
      <label>Current password
        <input name="password" type="password" autocomplete="current-password" maxlength="${MAX_PASSWORD_LENGTH}" />
      </label>
      <button type="button">Change email</button>
      <p class="status" role="status"></p>
    </section>
    <section data-password>
      <h2>Password</h2>
      <label>Current password
        <input name="current" type="password" autocomplete="current-password" maxlength="${MAX_PASSWORD_LENGTH}" />
      </label>
      <label>New password
        <input name="next" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" maxlength="${MAX_PASSWORD_LENGTH}" />
      </label>
      <button type="button">Change password</button>
      <p class="status" role="status"></p>
    </section>
    <section data-sessions>
      <h2>Devices</h2>
      <p>Sign out everywhere else. This device stays signed in.</p>
      <button type="button">Sign out other devices</button>
      <p class="status" role="status"></p>
    </section>
    <section data-delete>
      <h2>Delete account</h2>
      <p>This removes your account and cannot be undone.</p>
      <label>Password
        <input name="password" type="password" autocomplete="current-password" maxlength="${MAX_PASSWORD_LENGTH}" />
      </label>
      <button class="danger" type="button">Delete my account</button>
      <p class="status" role="status"></p>
    </section>`;

  const section = (name: string) => root.querySelector<HTMLElement>(`[data-${name}]`)!;
  const input = (sec: HTMLElement, name: string) =>
    sec.querySelector<HTMLInputElement>(`input[name=${name}]`)!;
  const button = (sec: HTMLElement) => sec.querySelector<HTMLButtonElement>("button:not(.swatch)")!;

  // Profile
  const profileSec = section("profile");
  const name = input(profileSec, "name");
  name.value = current.name;
  const swatches = AVATAR_COLORS.map((color, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.background = hex(color);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", `Colour ${i + 1}`);
    b.addEventListener("click", () => pick(i));
    profileSec.querySelector(".swatches")!.append(b);
    return b;
  });
  const pick = (i: number) => {
    avatar = i;
    swatches.forEach((b, j) => b.setAttribute("aria-checked", String(j === i)));
  };
  pick(avatar);
  button(profileSec).addEventListener("click", () =>
    run(profileSec, button(profileSec), async () => {
      current = await actions.updateProfile(name.value, avatar);
      name.value = current.name;
    }),
  );

  // Email
  const emailSec = section("email");
  const showEmail = () => {
    emailSec.querySelector("[data-current-email]")!.textContent = current.email;
  };
  showEmail();
  button(emailSec).addEventListener("click", () =>
    run(emailSec, button(emailSec), async () => {
      current = await actions.changeEmail(
        input(emailSec, "email").value,
        input(emailSec, "password").value,
      );
      input(emailSec, "email").value = "";
      input(emailSec, "password").value = "";
      showEmail();
      return "Email changed";
    }),
  );

  // Password
  const passwordSec = section("password");
  button(passwordSec).addEventListener("click", () =>
    run(passwordSec, button(passwordSec), async () => {
      await actions.changePassword(
        input(passwordSec, "current").value,
        input(passwordSec, "next").value,
      );
      input(passwordSec, "current").value = "";
      input(passwordSec, "next").value = "";
      return "Password changed. Your other devices were signed out.";
    }),
  );

  // Other devices
  const sessionsSec = section("sessions");
  button(sessionsSec).addEventListener("click", () =>
    run(sessionsSec, button(sessionsSec), async () => {
      await actions.signOutOthers();
      return "Other devices were signed out.";
    }),
  );

  // Delete
  const deleteSec = section("delete");
  button(deleteSec).addEventListener("click", () =>
    run(deleteSec, button(deleteSec), async () => {
      if (!window.confirm("Delete your account for good? This cannot be undone.")) return "";
      await actions.deleteAccount(input(deleteSec, "password").value);
    }),
  );

  return root;
}
