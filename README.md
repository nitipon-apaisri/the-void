# The Void

A self-built 2D virtual workspace, in the style of Gather, for about 100 people at once. You walk a pixel-art office as a character you designed, and you hear and see the people standing near you. It ships as a desktop app (macOS and Windows) and also runs in a browser.

## What it does

- **Accounts**: sign up with an email and password, edit your name and character, change email or password, sign out other devices, delete your account.
- **Spaces**: each space is its own room with its own members and its own voice. You pick one after signing in; the last one opens by itself.
- **Invite links**: owners and admins share a link, optionally needing their approval; pending people appear in the People panel.
- **Walking**: arrow keys or WASD, or click anywhere (on the map or the mini map) and your character finds a path round the walls. The office is 90 x 67 tiles: offices, meeting rooms, lounges and a cafeteria.
- **Desks**: walk up to a desk and claim it; your name shows on it. One desk each, per space.
- **Map controls**: a mini map and floating buttons for zoom and "show me". On a trackpad, pinch or two-finger scroll to zoom; hold and drag the map to pan. Moving, clicking to walk or "show me" brings the view back to you.
- **People panel**: everyone in the space, online and offline, with search. Click someone who is online to walk to them.
- **Proximity voice and video**: you hear and see only people within a few tiles. Mic, camera and screen share toggles; the range is a setting.
- **Character customize**: five layered parts (skin, eyes, outfit, hair, extra), each with a style and a colour.
- **Settings**: range, mic, camera and speaker choice, volume, movement keys, zoom, frame rate cap.

The server is authoritative. It checks who may join a space, and it refuses moves into walls or faster than walking speed.

## Feature checklist

Built and tried by hand:

- [x] Accounts: sign up, sign in, edit profile, change email or password, sign out other devices, delete account
- [x] Character customize (five layered parts)
- [x] Walking with arrow keys or WASD, and click to move with pathfinding
- [x] Proximity voice, video and screen share
- [x] Settings (range, devices, volume, keys, zoom, frame rate)
- [x] Desktop app shell (Electron)
- [x] Spaces, members and roles, with a space picker
- [x] People panel: online and offline, search, walk to someone
- [x] Invite links, with optional approval
- [x] Bigger map (90 x 67 tiles), mini map and map buttons
- [x] Server-side walls and speed limit
- [x] Pinch or two-finger scroll to zoom, hold and drag to pan
- [x] Claim a desk (one per person) and release it; the owner's name shows on it (server checked, not yet tried in the browser)

Planned (see [`PLAN.md`](PLAN.md)):

- [ ] Waving to a nearby person
- [ ] Decoration: place furniture
- [ ] Change roles, remove members, kick and ban
- [ ] Send each client only nearby players (needed for 100 people on this map)
- [ ] Text chat, status and do-not-disturb, follow a person
- [ ] Desktop notifications and the `thevoid://join/...` link
- [ ] Packaging for macOS and Windows, signing, auto-update
- [ ] Load test with 100 bots
- [ ] Password reset and email verification (needs a mail provider)

The full roadmap is in [`PLAN.md`](PLAN.md).

## How it fits together

| Package    | Stack                            | Role                                                      |
| ---------- | -------------------------------- | --------------------------------------------------------- |
| `client/`  | Vite, TypeScript, Phaser 4       | The game world and the DOM overlays                       |
| `server/`  | Colyseus 0.18, Express, Postgres | Accounts, spaces, realtime state, voice token issuing     |
| `desktop/` | Electron                         | Native shell that loads the client                        |
| `shared/`  | TypeScript (`@void/shared`)      | Message names, payload types and constants for both sides |

Voice and video go through a self-hosted [LiveKit](https://livekit.io) server (started by `docker compose`). Positions sync at about 12 Hz and the client smooths them.

## Requirements

- Node.js and npm (this repo uses npm workspaces; please do not switch to pnpm or yarn)
- Docker, for Postgres and LiveKit
- `osv-scanner` for the pre-push check (`brew install osv-scanner`)
- A copy of the LimeZu art pack (see below)

## Getting started

```bash
npm install
cp .env.example .env            # then set AUTH_SECRET (openssl rand -base64 48)
docker compose up -d            # LiveKit on :7880, Postgres on :5433
npm run migrate -w server       # create the tables
npm run assets:import           # copy the art (needs the pack, see below)

npm run dev:server              # Colyseus and the HTTP API on :2567
npm run dev:client              # Vite on :5173, open it in a browser
npm run dev:desktop             # or: build and launch the Electron app
```

Open two browser windows, create two accounts, make an invite link in the People panel with the first and open it with the second. Walk close together to hear each other.

### The art

The pictures come from the paid [Modern Interiors](https://limezu.itch.io/moderninteriors) pack by LimeZu. Its licence lets you use the art in your own app, with credit, but not redistribute it. So the pack and the sheets copied from it are **git-ignored and never committed**, and the credit line in the Settings window must stay.

Buy your own copy, unzip it to `client/src/assets/art/limezu/moderninteriors-win`, and run `npm run assets:import` once (it also takes a path: `npm run assets:import -- /path/to/pack`). Without it the client has no tiles or characters.

The map layout is ours and committed: `client/src/assets/maps/office.tmj`.

## Everyday commands

```bash
npm run typecheck     # tsc --noEmit for every package
npm run lint          # oxlint
npm run format        # prettier --write
npm test              # vitest
npm run audit:osv     # known-vulnerability scan of package-lock.json
```

Husky runs Prettier and Oxlint on staged files before a commit, and the vulnerability scan before a push.

## Layout

```
client/src/   scenes/ objects/ systems/ net/ ui/ utils/ config/ test/ assets/
server/src/   rooms/ routes/ services/ repositories/ common/ config/ test/
server/migrations/   timestamped, re-runnable .sql files
desktop/src/  main.ts preload.ts ipc/ windows/
shared/src/   the contract used by client and server
```

Game rules live in `client/src/systems/` as pure functions with no Phaser in them; only the scenes touch Phaser, and only `net/` talks to the network. [`AGENTS.md`](AGENTS.md) has the full conventions (folder rules, commit format, security, tests) and applies to people as much as to coding agents.

## Security notes

- Passwords are hashed with scrypt and never logged or returned. Login tokens are signed with `AUTH_SECRET`; the server will not start without it.
- Login and register are rate limited, and CORS is limited to `CORS_ORIGINS`.
- The LiveKit key and secret stay on the server; clients get short-lived tokens limited to their space.
- Never commit `.env`, keys or tokens.

## Before going to production

Set a strong `AUTH_SECRET`, `CORS_ORIGINS` for the packaged client and `TRUST_PROXY_HOPS`; use a real LiveKit key and TLS (`wss://`); add the macOS `Info.plist` usage strings and code signing. Password reset and email verification need a mail provider and are not built yet. Windows and packaged builds are untested.

## Licence

The code has no licence yet. The art is not ours to share; see "The art" above.
