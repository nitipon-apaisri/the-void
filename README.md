# The Void

A self-built 2D virtual workspace, in the style of Gather, for about 100 people at once. You walk a pixel-art office as a character you designed, and you hear and see the people standing near you. It ships as a desktop app (macOS and Windows) and also runs in a browser.

## What it does

- **Accounts**: sign up with an email and password, edit your name and character, change email or password, sign out other devices, delete your account.
- **Spaces**: each space is its own room with its own members and its own voice. After signing in you choose to join a space (one you are in, or a new one with a short code) or to create one; the last one opens by itself. A new space starts from a template (Classic office, Open plan, Studio or an Empty room) at a size (small, medium or large).
- **Invite links and codes**: owners and admins share a link or a short code, optionally needing their approval; pending people appear in the People panel. Owners and admins can draw private rooms on the map. Owners hand out roles, admins and owners remove or ban people (a ban also blocks their links and codes until lifted), and anyone can leave.
- **Walking**: arrow keys or WASD, or click anywhere (on the map or the mini map) and your character finds a path round the walls. The office is 90 x 67 tiles: offices, meeting rooms, lounges and a cafeteria.
- **Desks**: walk up to a desk and claim it; your name shows on it. One desk each, per space.
- **Sitting**: walk up to a chair and stop to sit down; move or click to stand again.
- **Decorating**: every member can place furniture, from about 125 pieces sorted into groups (tables, chairs, plants, rugs, wall, doors and so on; pick a group, then a piece), or cut from any art sheet, and remove it again; owners and admins can also empty the whole space (the template's own furniture too) to start bare; it is saved with the space.
- **Waving**: when someone is within four tiles, a button lets you wave at them.
- **Map controls**: a mini map and floating buttons for zoom and "show me". On a trackpad, pinch or two-finger scroll to zoom; hold and drag the map to pan. Moving, clicking to walk or "show me" brings the view back to you.
- **People panel**: everyone in the space, online and offline, with search. Click someone who is online to walk to them.
- **Proximity voice and video**: you hear and see only people within a few tiles. Mic, camera and screen share toggles; the range is a setting. A ring at someone's feet and a highlight on their video show who is talking. Private rooms: inside one, everyone in it hears and sees each other wherever they stand, and nobody outside does. The office and open plan have meeting rooms, and owners and admins can draw their own in any space.
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
- [x] Spaces, members and roles, with a Join or Create space picker
- [x] People panel: online and offline, search, walk to someone
- [x] Invite links and join codes, with optional approval
- [x] Change roles, remove or ban members, hand over a space, leave a space
- [x] Space sizes (small, medium, large)
- [x] Load test with 100 bots (`npm run load`)
- [x] Space templates (Classic office, Open plan, Studio, Empty room) picked when a space is created
- [x] Bigger map (90 x 67 tiles), mini map and map buttons
- [x] Server-side walls and speed limit
- [x] Pinch or two-finger scroll to zoom, hold and drag to pan
- [x] Claim a desk (one per person) and release it; the owner's name shows on it (tried by hand)
- [x] Decoration: every member places and removes furniture, from the catalogue or any art sheet (tried by hand)
- [x] Sit on desk, meeting and placed chairs; chairs tuck in closer to the desks (tried by hand)
- [x] Wave at a nearby person; they get a toast (tried by hand)

Planned (see [`PLAN.md`](PLAN.md)):

- [ ] Text chat, status and do-not-disturb, follow a person
- [ ] Desktop notifications and the `thevoid://join/...` link
- [ ] Packaging for macOS and Windows: `npm run package:desktop` is set up (unsigned macOS app checked); signing, the Windows build and auto-update are not done
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
- `gitleaks` for the secret scan on pre-commit and pre-push (`brew install gitleaks`)
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

The map layouts are ours and committed: `client/src/assets/maps/<template>.tmj` (`office`, `open-plan`, `studio`, `empty`). `npm run assets:import -- --map` regenerates all of them; the plans are in `scripts/import-art.mjs`.

To see which pieces the sheets hold, run `npm run dev:client` and open `/assets.html`: pick a sheet, click or drag over tiles, and copy their sheet, column, row and size. It reads your local copy of the art and is not part of the production build.

## Everyday commands

```bash
npm run typecheck     # tsc --noEmit for every package
npm run lint          # oxlint
npm run format        # prettier --write
npm test              # vitest
npm run audit:osv     # known-vulnerability scan of package-lock.json
npm run audit:secrets # gitleaks scan of the git history for committed secrets
npm run package:desktop # build the client and package the desktop app into release/ (unsigned unless you set up signing)
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

## Server specification

A starting point for about 100 people at once. The game server numbers come from `npm run load -- --bots 100 --seconds 30 --size large` (100 bots walking in one space on a laptop), and the LiveKit numbers from `test/load/voice.sh` (16 rooms of 6 people, so each hears 5 others, run against a local LiveKit with the load generators on the same laptop). Neither includes real browsers or a real network.

| Part                                 | Measured or estimated                                                                                                                                   | Start with                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Game server (Colyseus, one process)  | Measured: about 9% of one core, 110 MB, about 17 KB/s out per client (1.7 MB/s in total), event loop p99 under 25 ms                                    | 1 vCPU, 1 to 2 GB RAM. One room is single-threaded       |
| Postgres                             | Light: reads and writes are small, and a position is saved only when someone leaves                                                                     | 1 vCPU, 1 to 2 GB RAM, 10 GB disk, or a managed instance |
| LiveKit (voice, video, screen share) | Measured for 100 people: voice only about 2 Mbps out, about 1 core; every camera on (medium) about 120 Mbps out, about 1 core, 0.1% packet loss at most | 4 vCPU, 8 GB RAM, 1 Gbps link, public IP, open UDP ports |

- **One machine is enough to start**: 4 vCPU and 8 GB RAM running everything (game server, LiveKit and Postgres in Docker) with a 1 Gbps link. Split LiveKit onto its own machine when you want to scale voice separately.
- **Bandwidth is the limit to watch**, not CPU. A realistic mix (mostly audio, some video) is roughly 10 to 50 Mbps out of LiveKit (an estimate between the two measured runs); the worst case, 100 cameras on with 5 people nearby each, measured about 120 Mbps (1.1 to 1.4 Mbps per person), and real 720p cameras would cost somewhat more. Check the egress price of your host.
- **Not measured**: the HTTP API and database, screen shares, a real network (the LiveKit run was over loopback), and 100 real browsers (client frame rate with many sprites and video tiles on screen).
- Repeat the voice run with `test/load/voice.sh --rooms 16 --kind video --seconds 40` (`--kind audio` for voice only; needs `lk`, `brew install livekit-cli`).
- The game server does not yet send each client only nearby players; at this size it is not needed (see `PLAN.md`, step 8).

## Before going to production

Set a strong `AUTH_SECRET`, `CORS_ORIGINS` for the packaged client and `TRUST_PROXY_HOPS`; use a real LiveKit key and TLS (`wss://`); add `app://void` to `CORS_ORIGINS` for the packaged desktop app, set `VITE_SERVER_URL` to the real server before building it, and set up macOS code signing and notarization (the camera and microphone usage strings are already in the build). Password reset and email verification need a mail provider and are not built yet. The Windows build and a signed, installed app are untested.

## Licence

The code has no licence yet. The art is not ours to share; see "The art" above.
