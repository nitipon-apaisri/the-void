# Agent guide — The Void

Portable instructions for any coding agent (Claude Code, Cursor, Codex, Copilot, etc.). See `PLAN.md` for the roadmap.

Package manager: **npm** (workspaces). Do not switch to pnpm/yarn.

The Void is a self-built 2D virtual workspace (Gather-style) for ~100 users, shipped as a desktop app.

| Package    | Stack                               | Role                                                  |
| ---------- | ----------------------------------- | ----------------------------------------------------- |
| `client/`  | Vite, TypeScript, Phaser            | Game world and UI; must also run in a browser         |
| `server/`  | Colyseus 0.18, `@colyseus/schema` 5 | Authoritative realtime state, LiveKit token issuing   |
| `desktop/` | Electron, TypeScript (CommonJS)     | Native shell that loads the client                    |
| `shared/`  | TypeScript (`@void/shared`)         | Message types and constants used by client and server |

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

## Folder structure

**Always follow this layout.** Put new files in the right place; do not invent parallel layouts.

```
client/src/
├── main.ts            # bootstrap only: create the Phaser game, no logic
├── config/            # env (VITE_*), game constants
├── scenes/            # Phaser scenes (Boot, World). Thin: wire systems, no rules
├── objects/           # game objects (PlayerSprite, Door)
├── systems/           # pure game logic: movement, proximity, collision. No Phaser imports
├── net/               # Colyseus and LiveKit wrappers; the only code that talks to the network
├── ui/                # DOM overlays: name prompt, chat, controls
├── utils/
├── test/              # *.spec.ts (Vitest)
└── assets/            # maps (Tiled .tmj), tilesets, audio

server/src/
├── index.ts           # bootstrap only
├── config/            # env parsing
├── rooms/[room]/      # [room].room.ts, [room].state.ts (schema), handlers/, test/
├── routes/            # Express HTTP endpoints (auth, spaces); thin, call services
├── services/          # livekit tokens, auth, persistence
├── repositories/      # Postgres queries (when added)
├── common/            # validation, logging helpers
└── test/

server/migrations/     # timestamped, re-runnable .sql files (npm run migrate -w server)

desktop/src/
├── main.ts            # app lifecycle and window creation
├── preload.ts         # contextBridge API exposed to the renderer
├── ipc/               # main-process IPC handlers
├── windows/
└── test/

shared/src/            # message names, payload types, constants (imported as @void/shared)
```

- **Scenes** stay thin: create objects, call systems, forward input. Rules live in `systems/`.
- **Systems** are pure functions or small classes with no Phaser or network imports. This is what we unit-test.
- **`net/`** is the only place that imports `@colyseus/sdk` or LiveKit. Scenes call it through a small interface.
- **Spaces**: a room exists per space (`spaceId` join option); `t_space_members` says who belongs and with which role. Check membership on the server for every join and every space endpoint.
- **Rooms** own authoritative state and message handlers; **services** own side effects; **repositories** own DB queries.
- **Electron**: the renderer never gets Node access. Anything it needs goes through `preload.ts` with a typed, minimal API.
- **Shared contract**: message names and payload types are defined once in `shared/` and imported by both sides. Never duplicate string literals like `"move"`.
- Keep `main.ts` / `index.ts` to bootstrap only.

## Code quality

- TypeScript `strict`. No `any` unless commented why (Colyseus callbacks are the usual exception). Use `import type` for types.
- **Server is authoritative.** Validate every client message (type, finiteness, range, rate). Never trust client position beyond sanity limits.
- Server (ESM): relative imports use `.js` suffixes. Client: no suffix (Vite bundler resolution). Desktop: CommonJS output.
- Keep Colyseus on the **0.18** line: server `@colyseus/core`, `@colyseus/schema` 5, client `@colyseus/sdk`. Do not mix with the legacy `colyseus.js` 0.16 client. Client state listeners use `getStateCallbacks(room)`; `Room` generics take an options object (`Room<{ state: VoidState }>`).
- Position sync stays ~10–15 Hz with client interpolation. Do not send per-frame updates.
- No hardcoded URLs, keys or ports. Read from env/config.
- Small files, one responsibility. Prefer constructor/argument injection over importing singletons, so systems stay testable.
- Comments explain why, not what.

### Import groups

Order with `//` labels, blank line between groups:
`lib` → `shared` → `config` → `net` → `systems` → `objects` → `scenes` → `ui` → `utils` → relative.

## Tests

- Runner: **Vitest**. Unit tests live in `[package]/src/test/*.spec.ts` (or `rooms/[room]/test/` for a room). E2E / multi-client tests live in root `test/`.
- Test `systems/` logic (movement, proximity radius, collision), server message validation and room join/leave/move behaviour. Do not unit-test Phaser scenes.
- Load test (100 simulated bots, roadmap step 8) lives in `test/load/`.
- **Do not run tests** (`npm test`, `vitest`, etc.) unless the user explicitly asks, or the task is about a failing test or CI. Writing specs is fine; executing them is not, unless requested.

## New feature checklist

Shared types → server room handler/state → server tests → client system (pure) → client test → `net/` binding → scene/UI wiring → update `PLAN.md` status → note any new message in the shared contract.

## Agent behavior

- Only make changes the task needs. Do not refactor unrelated code or restructure folders without asking.
- **Destructive operations:** never drop or truncate tables, delete data without a filter, `git reset --hard`, force-push, or delete branches without asking first.
- **DB (when added):** snake_case tables and columns; prefix `m_*` for master data and `t_*` for transactional data; audit columns (`created_*`, `updated_*`, `deleted_*`) last. Migrations are created with a tool-generated timestamp and written re-runnable.
- Update `PLAN.md` status when a roadmap item is completed.

## Security

- **Vulnerabilities** (`npm run audit:osv`, `npm audit`): try to upgrade the affected dependency, including a major bump of the parent package. Only if no fixed version exists, ignore it (documented in `osv-scanner.toml` with a reason) until one does. Never ignore a fixable advisory.
- Never commit `.env`, credentials, private keys or tokens. Keep `.env.example` placeholders only.
- Passwords are hashed with scrypt on the server and never logged or returned. `AUTH_SECRET` signs login tokens; the server refuses to start without it. Login and register are rate limited, and login gives the same error for a wrong password and an unknown email.
- CORS is restricted to `CORS_ORIGINS` (it overrides Colyseus's reflect-any-origin default).
- LiveKit API key/secret live on the server only. The client receives short-lived, room-scoped tokens.
- Do not log tokens or full authorization headers.
- Electron: `contextIsolation` on, `nodeIntegration` off, `sandbox` on. Restrict permission handlers to what is needed (media). Never load remote content in a window with a preload API.
- Authorize on the server (room join, space membership and role), never only in the client.

## Art

The pictures come from the paid LimeZu "Modern Interiors" pack (https://limezu.itch.io/moderninteriors). Its licence allows use in the app, with credit, but not redistribution, so the pack and the sheets copied from it (`client/src/assets/art/`, `client/src/assets/game/`) are git-ignored and **never committed**. Each developer buys their own copy, unzips it to `client/src/assets/art/limezu/moderninteriors-win`, and runs `npm run assets:import` once (it also takes a path: `npm run assets:import -- /path/to/pack`). Without it the client has no tiles or characters.

- The map layouts are ours and committed: `client/src/assets/maps/<template>.tmj` for each of `SPACE_TEMPLATES` (90 x 67 tiles, generated by the import script; `MAP_COLS`/`MAP_ROWS` in `@void/shared` must match; every template keeps `SPAWN` walkable). Layers: `floor`, `decor` (under players), `objects`, and a hidden `collision` layer where any tile blocks movement. The import writes the map only if it is missing; `--map` regenerates it, which overwrites edits made in Tiled.
- Characters are five layers (skin, eyes, outfit, hair, extra) from the pack's character generator, imported to `client/src/assets/game/looks/`. A look is five indices stored on the user (`@void/shared`: `Look`, `LOOK_COUNTS`; the server validates them). Frames are 32 x 64, 56 per row; the layout lives in `client/src/systems/character-frames.ts`. The credit line in the Settings window must stay.

## Scripts

Run from the repo root:

```bash
docker compose up -d  # LiveKit on :7880 and Postgres on :5433 (needs a .env copied from .env.example)
npm run migrate -w server  # apply database migrations
npm run dev:server    # Colyseus on :2567
npm run dev:client    # Vite on :5173
npm run dev:desktop   # builds and launches Electron
```

Desktop is bundled with esbuild (so `@void/shared` is inlined, including into the sandboxed preload); `tsc` only typechecks it. Typecheck a package with `npx tsc -p .` inside it; `npm run build -w client` builds the client.

```bash
npm run lint          # oxlint
npm run format        # prettier --write
npm run format:check  # prettier --check
npm run assets:import # copy art sheets from your LimeZu pack into client/src/assets/game (see "Art" below)
npm run audit:osv     # osv-scanner on package-lock.json (also runs on pre-push)
npm run audit:secrets # gitleaks on git history (also runs on pre-push; staged files on pre-commit)
```

Husky: `pre-commit` → lint-staged (Prettier + Oxlint on staged files) and `gitleaks protect --staged`; `pre-push` → `npm run audit:osv` and `npm run audit:secrets` (need `osv-scanner` and `gitleaks` installed, e.g. `brew install osv-scanner gitleaks`). Allowlist false positives in `.gitleaks.toml`, never by skipping the hook.

```bash
npm run typecheck     # tsc --noEmit for shared, client, server, desktop
npm test              # vitest run (only when asked, see Tests)
```
