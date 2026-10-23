# PLAN.md

Goal: a self-built virtual workspace for ~100 concurrent users, as a desktop app (macOS, Windows; Linux optional).

## Architecture

| Layer          | Choice                   | Notes                                               |
| -------------- | ------------------------ | --------------------------------------------------- |
| Client         | TypeScript, Vite, Phaser | Tiled (`.tmj`) maps                                 |
| Realtime state | Colyseus 0.18            | One room per space (max 100 players each)           |
| Voice / video  | LiveKit                  | Self-hosted SFU (`docker compose up`)               |
| Auth           | Email and password       | Own server: scrypt hashes, signed 7-day tokens      |
| DB             | Postgres                 | Users, spaces, permissions                          |
| Desktop        | Electron                 | Chosen over Tauri for consistent WebRTC and WebGL   |
| Deploy         | Docker Compose on a VPS  | Colyseus, LiveKit (if self-hosted), Postgres, proxy |

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
1. **World** (done): Tiled map (`office.tmj`) with wall and desk collision, camera follow, join form, name labels. Placeholder art was replaced in 4b. The server enforces the same collision layer since 4d.
2. **Proximity A/V** (built, self-hosted LiveKit): the room answers a `voice-token` request with a short-lived, room-scoped token; the client subscribes only to players within 3 tiles (with hysteresis, set by `PROXIMITY_TILES`) and has mic and camera toggles. Local dev: `docker compose up -d`, copy `.env.example` to `.env`. Not yet verified with two live browsers, and production needs a real key, `use_external_ip` and TLS (`wss://`).
3. **Accounts** (built and verified in a browser): `/auth/register`, `/auth/login`, `/auth/me` on the game server; scrypt password hashes in Postgres (`t_users`); the room authenticates every join from a signed token and restores name, avatar and last position. Local dev: `docker compose up -d`, `npm run migrate -w server`. Still to do: password reset and email verification (needs a mail provider), profile editing, token revocation. Production: set a strong `AUTH_SECRET`, `CORS_ORIGINS` for the packaged client, `TRUST_PROXY_HOPS`, and TLS.
4. **Space features** (in this order; screen share is done, the rest is planned):
   - **4a. Settings** (built and verified by hand): one settings window with two tabs. _System_: proximity range, mic, camera and speaker choice, volume, key bindings, quality; kept per device in `localStorage`, and in the desktop app through the preload bridge if it needs OS access. _Account_: display name, change password, change email, sign out everywhere (needs token revocation), delete account. Built: proximity range, mic, camera and speaker, volume and movement keys (arrows, WASD or both) in System; name and colour, email and password change (both ask for the current password), sign out other devices, and delete account in Account. Tokens carry a version (`t_users.token_version`) so a password change or "sign out other devices" ends every other login. Still open: other devices stay connected to the room until they next reconnect, a graphics-quality setting waits for 4b, and password reset needs a mail provider.
   - **4b. Better graphic** (built and verified by hand): LimeZu Modern Interiors (paid, licensed, not committed; see AGENTS.md, Art). `npm run assets:import` copies the sheets we use; the map is redrawn with real floors, walls, workstations, a lounge and a meeting room; the 10 premade characters walk and idle in four directions (avatar 0 to 9). Collision comes from a hidden `collision` layer, so what you see and what blocks you can differ. Also built, not yet tried by hand: an `above` map layer so the tops of tall furniture draw over players who walk behind it, a gentler camera follow with a small dead zone, and graphics settings (zoom, frame rate cap, show names). Still open: a lighting pass. 4c builds on this sprite format.
   - **4c. Character customize** (built, not yet tried by hand): a character is five layered parts from the LimeZu generator (skin, eyes, outfit, hair, optional extra), each a style and a colour. Stored as `t_users.look` (`"body.eyes.outfit.hair.accessory"`), validated on the server against `LOOK_COUNTS` in `@void/shared`, and sent to everyone through room state. The client draws the layers into one texture per look the first time it is seen and caches the layer images; a preview with style and colour steppers and Shuffle sits in the sign-up form and in Settings, Account. The old premade `avatar` column is kept, unused. Still open: textures are never freed, and the layer lists follow pack v41.4 (the import warns if the counts differ).
   - **4d. Spaces** (replaces the single hardcoded room and the earlier private-rooms idea, which is dropped for now): every feature below belongs to a space, so this comes first. Order of work:
     - **P0 Spaces, members, roles, user list** (built, not yet tried by hand): `t_spaces` and `t_space_members` (roles owner, admin, member; the last position is kept per space). One Colyseus room per space (`filterBy(["spaceId"])`) and one LiveKit room per space. The server checks membership on join, loads the map's `collision` layer and refuses moves into walls or faster than walking speed (it sends `snap` to put the client back). The client shows a space picker after sign-in (the last space opens by itself), a Switch space button, and a People panel with online and offline members, search, and click to walk to someone. Accounts that existed before get one space, "The Void". New spaces use the office template. Still open: roles are stored but nothing changes by role yet, an owner who deletes their account leaves the space without an owner, and members are only added by the database until invites exist.
     - **P1 Invite by link** (built, not yet tried by hand): owners and admins make a link (ask-first or open, 1 day to never); only a hash of the token is stored, and the link is shown once. Opening `/?invite=<token>` signs in, asks "Join X?", then adds the person or files a request. Requests show in the People panel with Let in and Decline, and admins get a toast when someone is waiting (polled every 30 seconds). Links can be revoked; at most 20 are active per space. Still open: the `thevoid://join/...` deep link (desktop polish), removing members, and changing roles.
     - **P1 Bigger map, mini map, floating buttons** (built, not yet tried by hand): the office is now 90 x 67 tiles (about 5 times the area) as a 3 x 3 grid of rooms: three open offices, meeting rooms, a lounge, a plaza, a cafeteria and an event lounge, joined by doorways. `npm run assets:import -- --map` regenerates it. A mini map (bottom left) shows walls, people and the camera view, and a click on it walks you there. Floating buttons (bottom right): zoom in and out (0.5x to 3x), show me, and show or hide the mini map. Still open: interest management (each client only gets nearby players) before 100 people use a map this size, and the saved positions of people from the old map fall back to the spawn when they land in a wall.
     - **Trackpad zoom and drag to pan** (built, not yet tried by hand): pinch (or Cmd/Ctrl + wheel) zooms smoothly between 0.5x and 3x, toward the pointer when you have panned away; two-finger scroll over the map zooms the same way; hold and drag the map to pan; a plain click still walks. The view returns to you on movement, a click-to-walk or Show me. A pinch is not saved; the Settings zoom stays a steady level.
     - **P2 Claim a table** (built and tried by hand): the 60 desks are objects on a `tables` layer of `office.tmj` (the import script writes them with the map; ids are the object ids). Stand inside a desk's box (the desk and the seat in front of it) and a bar at the bottom offers Claim desk or Release desk; the owner's name shows on the desk. One desk per person and one person per desk, per space: the room checks the distance, then the database settles races (`t_table_claims`, unique indexes). Claims survive restarts. Still open: moving to another desk needs a release first, a member who leaves keeps the desk until member removal exists, and meeting tables are not claimable.
     - **P2 Waving** (built and tried by hand; going to a person from the People panel now runs at double speed): a "Wave at X" button appears above the voice bar when someone is within four tiles; the room checks the range (spamming is fine; only more than 20 a second is dropped), then tells only the waver and the target. Both see a hand float over the waver; the target also gets a toast. Nothing is stored. Still open: a desktop notification when the window is in the background (needs the notifications work), and waving at someone from the People panel.
     - **P3 Decoration (furniture)**: a catalogue, edit mode with grid placement, permission by role, saved per space, server-side collision.
     - **Nice to have**: text chat (was 4e), status and do-not-disturb, follow a person, desktop notifications for waves and invites, kick and ban, a broadcast or stage zone for all-hands talks.
   - Screen share, browser part (built and verified with two browsers): a Share screen toggle; viewers receive only the nearest sharer (`MAX_SCREEN_SHARES`); tokens may publish only mic, camera and screen. Desktop part (built and verified on macOS): the renderer shows its own picker (`ui/screen-picker.ts`), the main process lists sources over IPC and answers `getDisplayMedia` with the one that was picked. macOS needs Screen Recording permission, and packaging (step 7) needs the usage strings in `Info.plist`. Windows is untested.
5. **Admin**: roles, map editing workflow, room permissions.
6. **Desktop polish**: preload script, tray, notifications, global push-to-talk, deep links (`thevoid://join/...`), screen-source picker.
7. **Packaging**: electron-builder for macOS `.dmg` and Windows `.exe` (AppImage optional); macOS signing and notarization (Apple Developer account); Windows code signing; auto-update.
8. **Load test**: 100 simulated bots before real users.

## Open decisions

- Art: free pixel tilesets or custom assets
- Hosting provider
