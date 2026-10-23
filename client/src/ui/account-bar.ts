// utils
import { injectStyle } from "../utils/dom";

export interface AccountBar {
  setName(name: string): void;
  destroy(): void;
}

const STYLE_ID = "void-account-style";
const STYLES = `
.void-account { position: fixed; top: 12px; right: 12px; z-index: 900; display: flex; gap: 8px;
  align-items: center; padding: 6px 6px 6px 12px; border-radius: 8px; border: 1px solid #374151;
  background: #1f2937; color: #f9fafb; font: 14px system-ui, sans-serif; }
.void-account button { padding: 4px 10px; border-radius: 6px; border: 1px solid #374151;
  background: #111827; color: #f9fafb; cursor: pointer; font: inherit; }
.void-account button:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
`;

export function createAccountBar(
  name: string,
  actions: { onSettings: () => void; onSignOut: () => void },
): AccountBar {
  injectStyle(STYLE_ID, STYLES);
  const root = document.createElement("div");
  root.className = "void-account";
  const label = document.createElement("span");
  label.textContent = name;
  const makeButton = (text: string, onClick: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
  };
  root.append(
    label,
    makeButton("Settings", actions.onSettings),
    makeButton("Sign out", actions.onSignOut),
  );
  document.body.append(root);
  return {
    setName: (next) => (label.textContent = next),
    destroy: () => root.remove(),
  };
}
