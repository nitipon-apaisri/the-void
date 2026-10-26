// shared
import { formatInviteCode, type ConnectCode, type SpaceLink } from "@void/shared";

// ui
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface LinksDialogActions {
  list(): Promise<SpaceLink[]>;
  makeCode(): Promise<ConnectCode>;
  request(code: string): Promise<void>;
  approve(linkId: string): Promise<void>;
  end(linkId: string): Promise<void>;
}

const STYLE_ID = "void-links-style";
const STYLES = `
.void-links { position: fixed; inset: 0; z-index: 1500; display: grid; place-items: center;
  font: 14px/1.4 var(--v-font); color: var(--v-text); }
.void-links__panel { width: min(480px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto;
  padding: 24px; border-radius: var(--v-radius); display: grid; gap: 18px; }
.void-links__head { display: flex; justify-content: space-between; align-items: center; }
.void-links h1 { margin: 0; font-size: 20px; font-weight: 650; }
.void-links h2 { margin: 0; font-size: 13px; font-weight: 650; letter-spacing: 0.02em; text-transform: uppercase; color: var(--v-muted); }
.void-links p { margin: 0; color: var(--v-muted); }
.void-links section { display: grid; gap: 12px; }
.void-links input[type="text"] { padding: 9px 12px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-line);
  background: var(--v-field); color: var(--v-text); font: inherit; min-width: 0; flex: 1; }
.void-links button { padding: 8px 16px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-line); background: var(--v-field);
  color: var(--v-text); font: inherit; font-weight: 500; cursor: pointer; justify-self: start; }
.void-links button:hover:not(:disabled) { background: var(--v-hover); }
.void-links button.primary { background: var(--v-accent); border-color: var(--v-accent); color: var(--v-accent-ink); font-weight: 650; }
.void-links button:disabled { opacity: 0.6; cursor: wait; }
.void-links__row { display: flex; gap: 8px; }
.void-links ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.void-links li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 12px;
  border-radius: var(--v-radius-sm); background: var(--v-field); }
.void-links li small { display: block; color: var(--v-muted); }
.void-links li div:last-child { display: flex; gap: 6px; }
.void-links .error { color: var(--v-danger); min-height: 1.4em; }
.void-links :focus-visible { outline: 2px solid var(--v-accent); outline-offset: 2px; }
`;

const describe = (link: SpaceLink) => {
  if (link.status === "approved") return "Connected";
  return link.direction === "incoming" ? "Wants to connect with you" : "Waiting for their owner";
};

/** Owner tools for cross space: share a code, ask for a link, answer requests, end links. */
export function openLinksDialog(actions: LinksDialogActions, onClose: () => void): () => void {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  const opener = document.activeElement as HTMLElement | null;

  const overlay = document.createElement("div");
  overlay.className = "void-links v-scrim";
  overlay.innerHTML = `
    <div class="void-links__panel v-glass" role="dialog" aria-modal="true" aria-labelledby="void-links-title">
      <div class="void-links__head">
        <h1 id="void-links-title">Connected spaces</h1>
        <button type="button" data-close>Close</button>
      </div>
      <p>Everyone in a connected space can visit the other one through a portal. Both owners have to agree, and visitors cannot go any further.</p>
      <section>
        <h2>Let another space connect to this one</h2>
        <button type="button" class="primary" data-make>Make a connect code</button>
        <div class="void-links__row" data-made hidden>
          <input type="text" readonly aria-label="Connect code" />
          <button type="button" data-copy>Copy</button>
        </div>
        <p data-made-note hidden>Give it to the other owner now: it is not shown again, and a new code replaces this one.</p>
      </section>
      <section>
        <h2>Connect to another space</h2>
        <div class="void-links__row">
          <input type="text" name="code" placeholder="Their connect code" autocomplete="off" />
          <button type="button" data-ask>Ask</button>
        </div>
      </section>
      <section>
        <h2>Links</h2>
        <ul data-list></ul>
        <p data-none hidden>No links yet.</p>
      </section>
      <p class="error" role="alert"></p>
    </div>`;

  const q = <T extends Element>(selector: string) => overlay.querySelector<T>(selector)!;
  const makeButton = q<HTMLButtonElement>("[data-make]");
  const made = q<HTMLElement>("[data-made]");
  const madeNote = q<HTMLElement>("[data-made-note]");
  const madeInput = q<HTMLInputElement>("[data-made] input");
  const copyButton = q<HTMLButtonElement>("[data-copy]");
  const codeInput = q<HTMLInputElement>("input[name=code]");
  const askButton = q<HTMLButtonElement>("[data-ask]");
  const list = q<HTMLUListElement>("[data-list]");
  const none = q<HTMLElement>("[data-none]");
  const error = q(".error");

  const fail = (err: unknown) => {
    error.textContent = err instanceof Error ? err.message : "Something went wrong";
  };

  // Runs one action, then redraws the list; the button stays off while the server works.
  const run = async (button: HTMLButtonElement, action: () => Promise<void>) => {
    error.textContent = "";
    button.disabled = true;
    try {
      await action();
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      button.disabled = false;
    }
  };

  const button = (label: string, onClick: (self: HTMLButtonElement) => void, primary = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    if (primary) b.className = "primary";
    b.addEventListener("click", () => onClick(b));
    return b;
  };

  const render = (links: SpaceLink[]) => {
    none.hidden = links.length > 0;
    list.replaceChildren(
      ...links.map((link) => {
        const item = document.createElement("li");
        const text = document.createElement("div");
        text.textContent = link.space.name;
        const state = document.createElement("small");
        state.textContent = describe(link);
        text.append(state);
        const buttons = document.createElement("div");
        if (link.status === "pending" && link.direction === "incoming") {
          buttons.append(
            button("Accept", (b) => void run(b, () => actions.approve(link.id)), true),
            button("Decline", (b) => void run(b, () => actions.end(link.id))),
          );
        } else {
          const label = link.status === "approved" ? "End" : "Cancel";
          buttons.append(button(label, (b) => void run(b, () => actions.end(link.id))));
        }
        item.append(text, buttons);
        return item;
      }),
    );
  };

  const refresh = async () => render(await actions.list());

  makeButton.addEventListener("click", () =>
    run(makeButton, async () => {
      const { code } = await actions.makeCode();
      madeInput.value = formatInviteCode(code);
      copyButton.textContent = "Copy";
      made.hidden = false;
      madeNote.hidden = false;
      madeInput.select();
    }),
  );

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(madeInput.value);
      copyButton.textContent = "Copied";
    } catch {
      // Clipboard access can be refused; the text is selected so it can be copied by hand.
      madeInput.select();
    }
  });

  const ask = () =>
    run(askButton, async () => {
      await actions.request(codeInput.value);
      codeInput.value = "";
    });
  askButton.addEventListener("click", () => void ask());
  codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void ask();
  });

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
  makeButton.focus();
  refresh().catch(fail);
  return close;
}
