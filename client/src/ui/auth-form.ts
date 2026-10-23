// shared
import {
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type AuthSession,
} from "@void/shared";

// ui
import { createAvatarPicker } from "./avatar-picker";
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export type AuthMode = "login" | "register";

export interface AuthFields {
  email: string;
  password: string;
  name: string;
  avatar: number;
}

/** Performs the sign in or sign up; throws an Error whose message is safe to display. */
export type AuthSubmit = (mode: AuthMode, fields: AuthFields) => Promise<AuthSession>;

const STYLE_ID = "void-auth-style";
const STYLES = `
.void-auth { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center;
  background: radial-gradient(900px 520px at 50% 0%, rgb(139 147 255 / 0.22), transparent 70%), var(--v-bg);
  font: 14px/1.4 var(--v-font); color: var(--v-text); }
.void-auth form { width: min(380px, calc(100vw - 32px)); padding: 28px; border-radius: 22px;
  background: var(--v-glass); border: 1px solid var(--v-line); box-shadow: var(--v-shadow);
  -webkit-backdrop-filter: var(--v-blur); backdrop-filter: var(--v-blur); display: grid; gap: 16px; }
.void-auth h1 { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: -0.01em; }
.void-auth label { display: grid; gap: 6px; color: var(--v-muted); font-size: 13px; }
.void-auth input { padding: 11px 13px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-line);
  background: var(--v-field); color: var(--v-text); font: inherit; transition: border-color 0.15s, background 0.15s; }
.void-auth input:focus { outline: none; border-color: var(--v-accent); background: var(--v-hover); }
.void-auth button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
.void-auth [hidden] { display: none; }
.void-auth .submit { padding: 11px 14px; border-radius: 999px; border: 0; cursor: pointer;
  background: var(--v-accent); color: var(--v-accent-ink); font: inherit; font-weight: 650;
  transition: filter 0.15s; }
.void-auth .submit:hover:not(:disabled) { filter: brightness(1.1); }
.void-auth .submit:disabled { opacity: 0.6; cursor: wait; }
.void-auth .switch { background: none; border: 0; color: var(--v-accent); cursor: pointer; font: inherit; padding: 0; justify-self: start; }
.void-auth .error { margin: 0; color: var(--v-danger); min-height: 1.4em; }
`;

/** Shows the sign in / create account form until `submit` succeeds, then resolves with the session. */
export function promptAuth(submit: AuthSubmit, notice = ""): Promise<AuthSession> {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  let mode: AuthMode = "login";

  const overlay = document.createElement("div");
  overlay.className = "void-auth";
  overlay.innerHTML = `
    <form role="dialog" aria-modal="true" aria-labelledby="void-auth-title" novalidate>
      <h1 id="void-auth-title"></h1>
      <label>Email
        <input name="email" type="email" required autocomplete="email" maxlength="254" />
      </label>
      <label>Password
        <input name="password" type="password" required maxlength="${MAX_PASSWORD_LENGTH}" />
      </label>
      <label data-register hidden>Display name
        <input name="name" maxlength="${MAX_NAME_LENGTH}" autocomplete="nickname" />
      </label>
      <div data-register hidden class="avatar-slot"></div>
      <p class="error" role="alert"></p>
      <button class="submit" type="submit"></button>
      <button class="switch" type="button"></button>
    </form>`;

  const q = <T extends Element>(selector: string) => overlay.querySelector<T>(selector)!;
  const form = q<HTMLFormElement>("form");
  const title = q("h1");
  const email = q<HTMLInputElement>("input[name=email]");
  const password = q<HTMLInputElement>("input[name=password]");
  const name = q<HTMLInputElement>("input[name=name]");
  const error = q(".error");
  const submitButton = q<HTMLButtonElement>(".submit");
  const switchButton = q<HTMLButtonElement>(".switch");
  error.textContent = notice;

  const avatarPicker = createAvatarPicker(0, "Character");
  q(".avatar-slot").append(avatarPicker.element);

  const render = () => {
    const registering = mode === "register";
    title.textContent = registering ? "Create your account" : "Sign in to The Void";
    submitButton.textContent = registering ? "Create account" : "Sign in";
    switchButton.textContent = registering
      ? "Already have an account? Sign in"
      : "New here? Create an account";
    password.autocomplete = registering ? "new-password" : "current-password";
    password.minLength = registering ? MIN_PASSWORD_LENGTH : 0;
    overlay.querySelectorAll<HTMLElement>("[data-register]").forEach((el) => {
      el.hidden = !registering;
    });
    error.textContent = "";
  };
  switchButton.addEventListener("click", () => {
    mode = mode === "login" ? "register" : "login";
    render();
  });
  render();
  error.textContent = notice;

  document.body.append(overlay);
  email.focus();

  return new Promise((resolve) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.textContent = "";
      submitButton.disabled = true;
      try {
        const session = await submit(mode, {
          email: email.value,
          password: password.value,
          name: name.value,
          avatar: avatarPicker.value(),
        });
        overlay.remove();
        resolve(session);
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : "Something went wrong";
        submitButton.disabled = false;
      }
    });
  });
}
