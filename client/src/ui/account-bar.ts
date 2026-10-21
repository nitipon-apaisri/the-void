// utils
import { injectStyle } from "../utils/dom";

export interface AccountBar {
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

export function createAccountBar(name: string, onSignOut: () => void): AccountBar {
  injectStyle(STYLE_ID, STYLES);
  const root = document.createElement("div");
  root.className = "void-account";
  const label = document.createElement("span");
  label.textContent = name;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Sign out";
  button.addEventListener("click", onSignOut);
  root.append(label, button);
  document.body.append(root);
  return { destroy: () => root.remove() };
}
