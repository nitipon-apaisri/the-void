/**
 * The origin of a page, for deciding whether to trust it. `URL.origin` is the string "null" for
 * custom schemes such as `app:`, which would make every such page look like our own, so the
 * origin is built by hand for that scheme and for nothing else but http(s).
 */
export const APP_ORIGIN = "app://void";

export function originOf(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "app:") return parsed.host === "void" ? APP_ORIGIN : undefined;
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}
