import { defineConfig } from "vite";

// The single .env lives at the repo root (shared with the server). Vite only exposes
// variables prefixed VITE_ to the browser, so server secrets in the same file stay private.
export default defineConfig({ envDir: ".." });
