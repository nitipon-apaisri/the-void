// shared
import {
  AVATAR_COLORS,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type AuthSession,
} from "@void/shared";

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
  background: rgb(11 11 16 / 0.85); font: 14px/1.4 system-ui, sans-serif; color: #f9fafb; }
.void-auth form { width: min(360px, calc(100vw - 32px)); padding: 24px; border-radius: 12px;
  background: #111827; border: 1px solid #374151; display: grid; gap: 16px; }
.void-auth h1 { margin: 0; font-size: 18px; }
.void-auth label { display: grid; gap: 6px; color: #9ca3af; }
.void-auth input { padding: 10px 12px; border-radius: 8px; border: 1px solid #374151;
  background: #0b0b10; color: #f9fafb; font: inherit; }
.void-auth input:focus-visible, .void-auth button:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
.void-auth [hidden] { display: none; }
.void-auth .swatches { display: flex; gap: 10px; flex-wrap: wrap; }
.void-auth .swatch { width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
.void-auth .swatch[aria-checked="true"] { border-color: #f9fafb; }
.void-auth .submit { padding: 10px 12px; border-radius: 8px; border: 0; cursor: pointer;
  background: #6ee7b7; color: #052e1f; font: inherit; font-weight: 600; }
.void-auth .submit:disabled { opacity: 0.6; cursor: wait; }
.void-auth .switch { background: none; border: 0; color: #93c5fd; cursor: pointer; font: inherit; padding: 0; justify-self: start; }
.void-auth .error { margin: 0; color: #fca5a5; min-height: 1.4em; }
`;

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Shows the sign in / create account form until `submit` succeeds, then resolves with the session. */
export function promptAuth(submit: AuthSubmit, notice = ""): Promise<AuthSession> {
  injectStyle(STYLE_ID, STYLES);
  let mode: AuthMode = "login";
  let avatar = 0;

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
      <div data-register hidden role="radiogroup" aria-label="Avatar colour" class="swatches"></div>
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

  const swatches = AVATAR_COLORS.map((color, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.background = hex(color);
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", `Colour ${i + 1}`);
    b.addEventListener("click", () => selectAvatar(i));
    q(".swatches").append(b);
    return b;
  });
  const selectAvatar = (i: number) => {
    avatar = i;
    swatches.forEach((b, j) => b.setAttribute("aria-checked", String(j === i)));
  };
  selectAvatar(0);

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
          avatar,
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
