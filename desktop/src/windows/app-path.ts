import path from "node:path";

/**
 * Maps the path of an `app://void/...` request to a file inside `root` (the built client), or
 * undefined when it would reach outside it. `root` must already be absolute.
 */
export function resolveAppPath(root: string, pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (decoded.includes("\0")) return undefined;
  const relative = decoded.replace(/^\/+/, "") || "index.html";
  const file = path.resolve(root, relative);
  return file.startsWith(root + path.sep) ? file : undefined;
}
