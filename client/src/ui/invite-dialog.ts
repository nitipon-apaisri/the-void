// shared
import {
  formatInviteCode,
  type CreatedInvite,
  type InviteOptions,
  type InviteSummary,
} from "@void/shared";

// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface InviteDialogActions {
  create(options: InviteOptions): Promise<CreatedInvite>;
  list(): Promise<InviteSummary[]>;
  revoke(inviteId: string): Promise<void>;
  /** Turns a token into the link people will open. */
  link(token: string): string;
}

const EXPIRIES: ReadonlyArray<{ label: string; hours: number | null }> = [
  { label: "1 day", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
  { label: "Never", hours: null },
];

const STYLE_ID = "void-invite-style";
const STYLES = `
.void-invite { position: fixed; inset: 0; z-index: 1500; display: grid; place-items: center;
  font: 14px/1.4 var(--v-font); color: var(--v-text); }
.void-invite__panel { width: min(480px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto;
  padding: 24px; border-radius: var(--v-radius); display: grid; gap: 18px; }
.void-invite__head { display: flex; justify-content: space-between; align-items: center; }
.void-invite h1 { margin: 0; font-size: 20px; font-weight: 650; }
.void-invite h2 { margin: 0; font-size: 13px; font-weight: 650; letter-spacing: 0.02em; text-transform: uppercase; color: var(--v-muted); }
.void-invite p { margin: 0; color: var(--v-muted); }
.void-invite section { display: grid; gap: 12px; }
.void-invite label { display: grid; gap: 6px; color: var(--v-muted); }
.void-invite label.check { display: flex; align-items: center; gap: 10px; color: var(--v-text); }
.void-invite select, .void-invite input[type="text"] { padding: 9px 12px; border-radius: var(--v-radius-sm);
  border: 1px solid var(--v-line); background: var(--v-field); color: var(--v-text); font: inherit; }
.void-invite select option { background: var(--v-glass-solid); }
.void-invite input[type="checkbox"] { accent-color: var(--v-accent); width: 16px; height: 16px; }
.void-invite button { padding: 8px 16px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-line); background: var(--v-field);
  color: var(--v-text); font: inherit; font-weight: 500; cursor: pointer; justify-self: start; }
.void-invite button:hover:not(:disabled) { background: var(--v-hover); }
.void-invite button.primary { background: var(--v-accent); border-color: var(--v-accent); color: var(--v-accent-ink); font-weight: 650; }
.void-invite button:disabled { opacity: 0.6; cursor: wait; }
.void-invite__made { display: flex; gap: 8px; }
.void-invite__made input { flex: 1; min-width: 0; }
.void-invite ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.void-invite li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 12px;
  border-radius: var(--v-radius-sm); background: var(--v-field); }
.void-invite li small { display: block; color: var(--v-muted); }
.void-invite .error { color: var(--v-danger); min-height: 1.4em; }
.void-invite :focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
`;

const describe = (invite: InviteSummary) => {
  const expiry = invite.expiresAt
    ? `expires ${new Date(invite.expiresAt).toLocaleString()}`
    : "never expires";
  return `${invite.requiresApproval ? "Needs approval" : "Anyone with the link or code"} · ${expiry}`;
};

/** Make and revoke invite links for a space. Returns a function that closes it. */
export function openInviteDialog(actions: InviteDialogActions, onClose: () => void): () => void {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  const opener = document.activeElement as HTMLElement | null;

  const overlay = document.createElement("div");
  overlay.className = "void-invite v-scrim";
  overlay.innerHTML = `
    <div class="void-invite__panel v-glass" role="dialog" aria-modal="true" aria-labelledby="void-invite-title">
      <div class="void-invite__head">
        <h1 id="void-invite-title">Invite people</h1>
        <button type="button" data-close>Close</button>
      </div>
      <section>
        <label class="check"><input type="checkbox" name="approval" /> Ask me before they join</label>
        <label>Link and code work for
          <select name="expiry"></select>
        </label>
        <button type="button" class="primary" data-create>Create link and code</button>
        <div class="void-invite__made" data-made hidden>
          <input type="text" readonly aria-label="Invite link" />
          <button type="button" data-copy>Copy</button>
        </div>
        <div class="void-invite__made" data-made-code hidden>
          <input type="text" readonly aria-label="Join code" />
          <button type="button" data-copy-code>Copy</button>
        </div>
        <p data-made-note hidden>Copy them now: for safety the link and code are not shown again. People can type the code under "Join a space".</p>
      </section>
      <section>
        <h2>Active links and codes</h2>
        <ul data-list></ul>
        <p data-none hidden>No active links or codes.</p>
      </section>
      <p class="error" role="alert"></p>
    </div>`;

  const q = <T extends Element>(selector: string) => overlay.querySelector<T>(selector)!;
  const approval = q<HTMLInputElement>("input[name=approval]");
  const expiry = q<HTMLSelectElement>("select[name=expiry]");
  const createButton = q<HTMLButtonElement>("[data-create]");
  const made = q<HTMLElement>("[data-made]");
  const madeNote = q<HTMLElement>("[data-made-note]");
  const madeInput = q<HTMLInputElement>("[data-made] input");
  const copyButton = q<HTMLButtonElement>("[data-copy]");
  const madeCode = q<HTMLElement>("[data-made-code]");
  const codeInput = q<HTMLInputElement>("[data-made-code] input");
  const copyCodeButton = q<HTMLButtonElement>("[data-copy-code]");
  const list = q<HTMLUListElement>("[data-list]");
  const none = q<HTMLElement>("[data-none]");
  const error = q(".error");

  EXPIRIES.forEach((e, i) => expiry.append(new Option(e.label, String(i), false, i === 1)));

  const fail = (err: unknown) => {
    error.textContent = err instanceof Error ? err.message : "Something went wrong";
  };

  const renderList = (invites: InviteSummary[]) => {
    none.hidden = invites.length > 0;
    list.replaceChildren(
      ...invites.map((invite) => {
        const item = document.createElement("li");
        const text = document.createElement("div");
        text.textContent = describe(invite);
        const by = document.createElement("small");
        by.textContent = `made by ${invite.createdByName}`;
        text.append(by);
        const revoke = document.createElement("button");
        revoke.type = "button";
        revoke.textContent = "Revoke";
        revoke.addEventListener("click", async () => {
          revoke.disabled = true;
          try {
            await actions.revoke(invite.id);
            await refresh();
          } catch (err) {
            fail(err);
            revoke.disabled = false;
          }
        });
        item.append(text, revoke);
        return item;
      }),
    );
  };

  const refresh = async () => renderList(await actions.list());

  createButton.addEventListener("click", async () => {
    error.textContent = "";
    createButton.disabled = true;
    try {
      const invite = await actions.create({
        requiresApproval: approval.checked,
        expiresInHours: EXPIRIES[Number(expiry.value)]!.hours,
      });
      madeInput.value = actions.link(invite.token);
      codeInput.value = formatInviteCode(invite.code);
      copyButton.textContent = "Copy";
      copyCodeButton.textContent = "Copy";
      made.hidden = false;
      madeCode.hidden = false;
      madeNote.hidden = false;
      madeInput.select();
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      createButton.disabled = false;
    }
  });

  const copyFrom = (input: HTMLInputElement, button: HTMLButtonElement) => async () => {
    try {
      await navigator.clipboard.writeText(input.value);
      button.textContent = "Copied";
    } catch {
      // Clipboard access can be refused; the text is selected so it can be copied by hand.
      input.select();
    }
  };
  copyButton.addEventListener("click", copyFrom(madeInput, copyButton));
  copyCodeButton.addEventListener("click", copyFrom(codeInput, copyCodeButton));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    opener?.focus();
    onClose();
  }
  q("[data-close]").addEventListener("click", close);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);

  document.body.append(overlay);
  createButton.focus();
  refresh().catch(fail);
  return close;
}
