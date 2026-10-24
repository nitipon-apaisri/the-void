import { net, protocol } from "electron";
import { pathToFileURL } from "node:url";

import { resolveAppPath } from "./app-path";

export const APP_URL = "app://void/";

/** Must run before the app is ready. A secure, standard scheme gets camera, mic and fetch like https. */
export function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Serves the built client from `root` so the packaged app needs no web server for its pages. */
export function serveApp(root: string) {
  const notFound = () => new Response("not found", { status: 404 });
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    const file = url.host === "void" ? resolveAppPath(root, url.pathname) : undefined;
    if (!file) return notFound();
    try {
      return await net.fetch(pathToFileURL(file).toString());
    } catch {
      return notFound();
    }
  });
}
