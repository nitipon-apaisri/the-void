# AGENTS.md

Guidance for AI coding agents working in this repo. See `PLAN.md` for the roadmap.

## Project

The Void: a self-built 2D virtual workspace (Gather-style) for ~100 users, shipped as a desktop app.

npm workspaces monorepo:

| Package    | Stack                          | Role                                   |
| ---------- | ------------------------------ | -------------------------------------- |
| `client/`  | Vite, TypeScript, Phaser       | Game world and UI; also runs in a browser |
| `server/`  | Colyseus 0.16, `@colyseus/schema` 3 | Authoritative room state (`VoidRoom`) |
| `desktop/` | Electron, TypeScript (CommonJS) | Native shell that loads the client     |

## Commands

Run from the repo root:

```text
npm run dev:server    # Colyseus on :2567
npm run dev:client    # Vite on :5173
npm run dev:desktop   # builds and launches Electron
```

Typecheck a package with `npx tsc -p .` inside it. `client` also has `npm run build -w client`.

## Conventions

- Keep Colyseus packages on the 0.16 line. `colyseus.js` 0.16 is not compatible with the 0.18 server packages.
- The client must keep working in a plain browser. Electron-only code lives in `desktop/`.
- Electron: `contextIsolation` on, `nodeIntegration` off, `sandbox` on. Expose anything the renderer needs through a preload script.
- Validate every client message on the server. The server is authoritative.
- Never commit secrets. Use `.env` (gitignored) and `VITE_`-prefixed vars only for non-secret client config.

## Gitmoji commits

When creating git commits (only when the user asks), use:

```text
{emoji} ({type}): {imperative, concise message}
```

Examples: `✨ (feat): Add shipment tracking page`, `🐛 (bug): Fix null carrier on save`.

| Change                      | Prefix                     |
| --------------------------- | -------------------------- |
| New feature                 | `✨ (feat):`               |
| Bug fix                     | `🐛 (bug):`                |
| Performance                 | `⚡️ (improve):`            |
| UI / style                  | `💄 (ui):`                 |
| Refactor                    | `♻️ (refactor):`           |
| Config / tooling            | `🔧 (config):`             |
| Add / remove / upgrade deps | `➕` / `➖` / `⬆️ (deps):` |
| Documentation               | `📝 (docs):`               |
| Tests                       | `✅ (test):`               |
| CI                          | `💚 (ci):`                 |
| Lint                        | `🚨 (lint):`               |
| Remove code                 | `🔥 (remove):`             |
| Security                    | `🔒 (security):`           |
| Breaking                    | `💥 (breaking):`           |
| Hotfix                      | `🚑 (hotfix):`             |
| i18n                        | `🌐 (i18n):`               |

One primary emoji per commit. Do not commit secrets. Catalog: https://gitmoji.dev/
