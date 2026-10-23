// ui
import { applyTheme } from "./theme";

// systems
import type { TablePrompt } from "../systems/tables";

// utils
import { injectStyle } from "../utils/dom";

export interface TablePromptView {
  /** Shows what the nearby desk offers; undefined hides it. */
  show(prompt: TablePrompt | undefined): void;
  /** Disables the button while a claim or release is in flight. */
  setBusy(busy: boolean): void;
  destroy(): void;
}

export interface TablePromptActions {
  onClaim(tableId: string): void;
  onRelease(): void;
}

const STYLE_ID = "void-table-prompt-style";
const STYLES = `
.void-tableprompt { position: fixed; left: 50%; bottom: 108px; z-index: 950; display: none; align-items: center; gap: 12px;
  transform: translateX(-50%); padding: 8px 8px 8px 16px; border-radius: 999px; font: 500 13px/1.4 var(--v-font);
  color: var(--v-text); max-width: calc(100vw - 32px); }
.void-tableprompt[data-visible="true"] { display: flex; }
.void-tableprompt button { padding: 7px 14px; border: 0; border-radius: 999px; font: 600 13px var(--v-font); cursor: pointer;
  background: var(--v-accent); color: #0b0d14; }
.void-tableprompt button:disabled { opacity: 0.5; cursor: default; }
.void-tableprompt button:focus-visible { outline: 2px solid var(--v-text); outline-offset: 2px; }
.void-tableprompt button[hidden] { display: none; }
`;

/** A small bar at the bottom centre, above the voice bar: claim or release the desk you are standing at. */
export function createTablePrompt(actions: TablePromptActions): TablePromptView {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);
  const root = document.createElement("div");
  root.className = "void-tableprompt v-glass";
  root.setAttribute("role", "status");
  const text = document.createElement("span");
  const button = document.createElement("button");
  button.type = "button";
  root.append(text, button);
  document.body.append(root);

  let current: TablePrompt | undefined;
  button.addEventListener("click", () => {
    if (current?.kind === "claim") actions.onClaim(current.table.id);
    else if (current?.kind === "release") actions.onRelease();
  });

  return {
    show(prompt) {
      // Called every frame the player moves, so skip the DOM when nothing changed.
      if (prompt?.kind === current?.kind && prompt?.table.id === current?.table.id) return;
      current = prompt;
      root.dataset.visible = String(Boolean(prompt));
      if (!prompt) return;
      const name = prompt.table.name;
      button.hidden = prompt.kind === "taken" || prompt.kind === "has-desk";
      if (prompt.kind === "claim")
        [text.textContent, button.textContent] = [`${name} is free`, "Claim desk"];
      else if (prompt.kind === "release")
        [text.textContent, button.textContent] = [`${name} is yours`, "Release desk"];
      else if (prompt.kind === "taken") text.textContent = `${name} belongs to ${prompt.owner}`;
      else text.textContent = `${name} is free, but you already have a desk`;
    },
    setBusy: (busy) => {
      button.disabled = busy;
    },
    destroy: () => root.remove(),
  };
}
