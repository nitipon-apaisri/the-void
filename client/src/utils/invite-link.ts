// A link looks like <app address>/?invite=<token>. The token is the only secret in it.
const PARAM = "invite";
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** The token in a query string like "?invite=abc", or undefined if there is none or it is malformed. */
export function parseInviteToken(search: string): string | undefined {
  const value = new URLSearchParams(search).get(PARAM);
  return value && TOKEN.test(value) ? value : undefined;
}

export function buildInviteLink(base: string, token: string): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set(PARAM, token);
  return url.toString();
}

/** Where links should point. VITE_INVITE_BASE_URL wins (the packaged app has no web address of its own). */
export const inviteBase = (): string =>
  import.meta.env.VITE_INVITE_BASE_URL ?? `${location.origin}${location.pathname}`;

/** Reads the token from the address bar, then removes it so a reload or a screenshot does not leak it. */
export function takeInviteFromUrl(): string | undefined {
  const token = parseInviteToken(location.search);
  if (!new URLSearchParams(location.search).has(PARAM)) return token;
  try {
    const url = new URL(location.href);
    url.searchParams.delete(PARAM);
    history.replaceState(null, "", url);
  } catch {
    // ignore
  }
  return token;
}
