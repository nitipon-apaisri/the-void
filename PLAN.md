# PLAN.md

Goal: a self-built virtual workspace for ~100 concurrent users, as a desktop app (macOS, Windows; Linux optional).

## Architecture

| Layer          | Choice                   | Notes                                                |
| -------------- | ------------------------ | ---------------------------------------------------- |
| Client         | TypeScript, Vite, Phaser | Tiled (`.tmj`) maps                                  |
| Realtime state | Colyseus 0.18            | One main room (max 100) plus rooms for private areas |
| Voice / video  | LiveKit                  | Self-hosted SFU (`docker compose up`)                |
| Auth           | Email and password       | Own server: scrypt hashes, signed 7-day tokens       |
| DB             | Postgres                 | Users, spaces, permissions                           |
| Desktop        | Electron                 | Chosen over Tauri for consistent WebRTC and WebGL    |
| Deploy         | Docker Compose on a VPS  | Colyseus, LiveKit (if self-hosted), Postgres, proxy  |

## Design rules for 100 users

- Proximity video: subscribe only to players within ~3 tiles; unsubscribe on leave. Never full mesh.
- Position sync at ~10–15 Hz; client interpolates.
- Interest management: send each client only nearby players once the room grows.
- Cap video tiles per user in crowded areas.

## Status

- [x] Monorepo scaffold: `client/`, `server/`, `desktop/`
- [x] Colyseus room syncing name and position
- [x] Phaser client with movement and other players as dots
- [x] Electron shell loading the client
- [x] Server verified with two SDK clients (join, move, invalid input, leave)
- [x] Verified in the Phaser window (browser)
- [x] Electron shell launches, loads the client and exposes the preload bridge
- [x] Proximity audio and video verified with two browsers

## Roadmap

0. **Foundations** (done): layout from `AGENTS.md`, `@void/shared` contract, Oxlint, Prettier, Vitest, `typecheck`, Husky, `.env.example`.
1. **World** (done, placeholder art): Tiled map (`office.tmj`) with client-side wall/desk collision, camera follow, join form (name and colour), name labels. Placeholder art was replaced in 4b. Known gap: the server validates world bounds but not walls, so collision is client-trusted until the server loads the same map.
2. **Proximity A/V** (built, self-hosted LiveKit): the room answers a `voice-token` request with a short-lived, room-scoped token; the client subscribes only to players within 3 tiles (with hysteresis, set by `PROXIMITY_TILES`) and has mic and camera toggles. Local dev: `docker compose up -d`, copy `.env.example` to `.env`. Not yet verified with two live browsers, and production needs a real key, `use_external_ip` and TLS (`wss://`).
3. **Accounts** (built and verified in a browser): `/auth/register`, `/auth/login`, `/auth/me` on the game server; scrypt password hashes in Postgres (`t_users`); the room authenticates every join from a signed token and restores name, avatar and last position. Local dev: `docker compose up -d`, `npm run migrate -w server`. Still to do: password reset and email verification (needs a mail provider), profile editing, token revocation. Production: set a strong `AUTH_SECRET`, `CORS_ORIGINS` for the packaged client, `TRUST_PROXY_HOPS`, and TLS.
4. **Space features** (in this order; screen share is done, the rest is planned):
   - **4a. Settings** (built and verified by hand): one settings window with two tabs. _System_: proximity range, mic, camera and speaker choice, volume, key bindings, quality; kept per device in `localStorage`, and in the desktop app through the preload bridge if it needs OS access. _Account_: display name, change password, change email, sign out everywhere (needs token revocation), delete account. Built: proximity range, mic, camera and speaker, volume and movement keys (arrows, WASD or both) in System; name and colour, email and password change (both ask for the current password), sign out other devices, and delete account in Account. Tokens carry a version (`t_users.token_version`) so a password change or "sign out other devices" ends every other login. Still open: other devices stay connected to the room until they next reconnect, a graphics-quality setting waits for 4b, and password reset needs a mail provider.
   - **4b. Better graphic** (built and verified by hand): LimeZu Modern Interiors (paid, licensed, not committed; see AGENTS.md, Art). `npm run assets:import` copies the sheets we use; the map is redrawn with real floors, walls, workstations, a lounge and a meeting room; the 10 premade characters walk and idle in four directions (avatar 0 to 9). Collision comes from a hidden `collision` layer, so what you see and what blocks you can differ. Still open: a lighting and depth pass (tall furniture drawn over players), smoother camera, and a graphics-quality setting. 4c builds on this sprite format.
   - **4c. Character customize**: layered sprites (body, hair, outfit, accessory) and colours, stored on `t_users`, validated against an allowlist on the server, shown to everyone through room state, with a preview in the sign-up and settings screens.
   - **4d. Private rooms**: the server loads the same Tiled map and enforces wall collision first, then door tiles and a per-room access list; voice and screen share only cross a room boundary through a door. Authorize on the server, not just the client.
   - **4e. Chat and emotes** (kept, not yet scheduled): live chat first, persistence undecided.
   - Screen share, browser part (built and verified with two browsers): a Share screen toggle; viewers receive only the nearest sharer (`MAX_SCREEN_SHARES`); tokens may publish only mic, camera and screen. Desktop part (built and verified on macOS): the renderer shows its own picker (`ui/screen-picker.ts`), the main process lists sources over IPC and answers `getDisplayMedia` with the one that was picked. macOS needs Screen Recording permission, and packaging (step 7) needs the usage strings in `Info.plist`. Windows is untested.
5. **Admin**: roles, map editing workflow, room permissions.
6. **Desktop polish**: preload script, tray, notifications, global push-to-talk, deep links (`thevoid://join/...`), screen-source picker.
7. **Packaging**: electron-builder for macOS `.dmg` and Windows `.exe` (AppImage optional); macOS signing and notarization (Apple Developer account); Windows code signing; auto-update.
8. **Load test**: 100 simulated bots before real users.

## Open decisions

- Art: free pixel tilesets or custom assets
- Hosting provider
