// lib
import Phaser from "phaser";

// shared
import {
  SPAWN,
  TILE_SIZE,
  TABLES_LAYER,
  WAVE_RANGE,
  canManageMembers,
  type AuthSession,
  type DesktopBridge,
  type JoinRequest,
  type Look,
  type MapTable,
  type Position,
  type SpaceMember,
  type SpaceSummary,
} from "@void/shared";

// config
import {
  API_URL,
  CONNECT_RETRY_MS,
  DEFAULT_PROXIMITY_TILES,
  PROXIMITY_CHECK_MS,
  MOVE_SEND_INTERVAL_MS,
  PLAYER_RADIUS,
  PLAYER_RUN_SPEED,
  PLAYER_SPEED,
  REMOTE_TWEEN_MS,
  SERVER_URL,
} from "../config/env";

// net
import { AuthRequestError, createAuthClient } from "../net/auth-client";
import { createSpaceClient } from "../net/space-client";
import { connectVoice, listMediaDevices, type VoiceConnection } from "../net/voice-connection";
import {
  NotInSpaceError,
  NotSignedInError,
  connectToVoid,
  type TableClaimSnapshot,
  type VoidConnection,
} from "../net/void-connection";

// systems
import { anchorCenter, isDrag, panBy } from "../systems/pan";
import { effectiveZoom, stepZoom, zoomByWheel } from "../systems/zoom";
import { createGrid, moveWithCollision, type CollisionGrid } from "../systems/collision";
import { readDirection } from "../systems/controls";
import { findPath, followPath } from "../systems/pathfinding";
import { stepPosition } from "../systems/movement";
import { nearbyIds, sortByDistance } from "../systems/proximity";
import { defaultSettings, type Settings } from "../systems/settings";
import { tablePrompt, type Claim } from "../systems/tables";

// objects
import { PlayerSprite } from "../objects/player";

// ui
import { createAccountBar, type AccountBar } from "../ui/account-bar";
import { promptAuth } from "../ui/auth-form";
import { confirmDialog } from "../ui/confirm";
import { openInviteDialog } from "../ui/invite-dialog";
import { createMapControls, type MapControls } from "../ui/map-controls";
import { createMinimap, type Minimap } from "../ui/minimap";
import { createPeoplePanel, type PeoplePanel } from "../ui/people-panel";
import { chooseScreenSource } from "../ui/screen-picker";
import { chooseSpace } from "../ui/space-picker";
import { openSettings } from "../ui/settings-window";
import { createWaveButton, type WaveButton } from "../ui/wave-button";
import { createTablePrompt, type TablePromptView } from "../ui/table-prompt";
import { createToast, type Toast } from "../ui/toast";
import { createZoomControls, type ZoomControls } from "../ui/zoom-controls";
import { createVoicePanel, type VoicePanel } from "../ui/voice-panel";

// utils
import { desktopBridge } from "../utils/desktop-bridge";
import { buildInviteLink, inviteBase, takeInviteFromUrl } from "../utils/invite-link";
import { tilesetUrls } from "../utils/game-art";
import { clearSession, loadSession, saveSession } from "../utils/session";
import { loadSettings, saveSettings } from "../utils/settings-store";
import { forgetLastSpace, loadLastSpace, saveLastSpace } from "../utils/space-store";

import mapUrl from "../assets/maps/office.tmj?url";

export class WorldScene extends Phaser.Scene {
  private connection?: VoidConnection;
  private connecting = false;
  private wasOffline = false;
  private toast!: Toast;
  private voicePanel!: VoicePanel;
  private voice?: VoiceConnection;
  private nearby: ReadonlySet<string> = new Set();
  private lastProximity = 0;
  private grid!: CollisionGrid;
  private readonly auth = createAuthClient(API_URL);
  private readonly spaces = createSpaceClient(API_URL);
  private session?: AuthSession;
  private space?: SpaceSummary;
  private people?: PeoplePanel;
  private members: SpaceMember[] = [];
  // Account behind each session in the room, to tell who from the member list is online.
  private readonly accounts = new Map<string, string>();
  private requestCount = 0;
  private requestTimer?: Phaser.Time.TimerEvent;
  private closeInvite?: () => void;
  // From the link this page was opened with, if any; used once, right after sign-in.
  private readonly inviteToken = takeInviteFromUrl();
  private accountBar?: AccountBar;
  private me?: PlayerSprite;
  private others = new Map<string, PlayerSprite>();
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private readonly defaults = defaultSettings(DEFAULT_PROXIMITY_TILES);
  private settings: Settings = loadSettings(this.defaults);
  private closeSettings?: () => void;
  private zoomControls?: ZoomControls;
  private minimap?: Minimap;
  private mapControls?: MapControls;
  private minimapShown = true;
  private lastMinimap = 0;
  private tables: MapTable[] = [];
  private claims = new Map<string, Claim>();
  private readonly tableLabels = new Map<string, Phaser.GameObjects.Text>();
  private tablePromptView?: TablePromptView;
  private lastTablePrompt = 0;
  private waveButton?: WaveButton;
  private waveTarget?: string;
  // True while the route came from "go to a person": that is quicker than walking.
  private running = false;
  // Where a click is sending us: waypoints still to reach.
  private route: Position[] = [];
  // The zoom on screen. Settings keep a steady level; a pinch moves this in between.
  private viewZoom = this.settings.zoom;
  // True after a drag or scroll takes the camera off the player.
  private looseCamera = false;
  private press?: { start: Position; last: Position; dragging?: boolean };
  private lastSent = 0;
  private unsent = false;

  constructor() {
    super("world");
  }

  preload() {
    this.load.tilemapTiledJSON("office", mapUrl);
    for (const [name, url] of Object.entries(tilesetUrls)) this.load.image(name, url);
  }

  create() {
    const map = this.make.tilemap({ key: "office" });
    const tilesets = map.tilesets.map((t) => map.addTilesetImage(t.name, t.name)!);
    for (const name of ["floor", "decor", "objects"]) map.createLayer(name, tilesets);
    // The tops of tall things (a TV, a shelf) hang over players who walk behind them.
    if (map.getLayer("above")) map.createLayer("above", tilesets)?.setDepth(20);
    // "collision" is never drawn: any tile in it blocks movement.
    const collision = map.getLayer("collision");
    if (!collision) throw new Error("the map has no collision layer");
    this.grid = createGrid(
      map.width,
      map.height,
      map.tileWidth,
      (col, row) => collision.data[row][col].index > 0,
    );
    this.setUpTables(map);
    this.waveButton = createWaveButton(() => this.waveAtTarget());
    this.minimap = createMinimap(this.grid, (target) => this.walkToPoint(target));
    this.mapControls = createMapControls({
      onZoomIn: () => this.setZoom(stepZoom(this.viewZoom, 1)),
      onZoomOut: () => this.setZoom(stepZoom(this.viewZoom, -1)),
      onLocate: () => this.showMe(),
      onToggleMinimap: () => {
        this.minimapShown = !this.minimapShown;
        this.minimap?.setVisible(this.minimapShown);
        this.mapControls?.setMinimapShown(this.minimapShown);
      },
    });
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.applyGraphics();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.applyGraphics());

    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as typeof this.wasd;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.pressMap(pointer));
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.dragMap(pointer));
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => this.releaseMap(pointer));
    this.input.on("pointerupoutside", () => this.endPress());
    this.toast = createToast();
    this.voicePanel = createVoicePanel();
    this.voicePanel.setVolume(this.settings.volume);
    this.voicePanel.onToggleMic(async (on) => {
      await this.voice?.setMicEnabled(on);
    });
    this.voicePanel.onToggleCamera(async (on) => {
      await this.voice?.setCameraEnabled(on);
    });
    this.voicePanel.onToggleScreen(async (on) => {
      // The desktop shell has no built-in picker, so ours runs first. Browsers use their own.
      const bridge = desktopBridge();
      if (on && bridge) await this.pickScreen(bridge);
      await this.voice?.setScreenShareEnabled(on);
    });
    this.zoomControls = createZoomControls({
      onStep: (direction) => this.setZoom(stepZoom(this.viewZoom, direction)),
      onReset: () => this.setZoom(this.defaults.zoom),
      onPinch: (deltaY, x, y) => this.pinchZoom(deltaY, x, y),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.zoomControls?.destroy();
      this.minimap?.destroy();
      this.mapControls?.destroy();
      this.tablePromptView?.destroy();
      this.waveButton?.destroy();
      this.closeSettings?.();
      void this.stopVoice();
      void this.connection?.leave();
      this.toast.destroy();
      this.voicePanel.destroy();
      this.accountBar?.destroy();
      this.people?.destroy();
      this.closeInvite?.();
    });
    void this.enter();
  }

  private async enter() {
    // The form's text input must receive arrow keys, so pause game input while it is open.
    this.setGameInput(false);
    const session = await this.signIn();
    this.session = session;
    this.setGameInput(true);
    const space = await this.pickSpace(session);
    this.space = space;
    this.people = createPeoplePanel({
      onGoTo: (userId) => this.goToUser(userId),
      onTyping: (on) => this.setGameInput(!on),
      onToggle: (open) => this.accountBar?.setPeopleOpen(open),
      onInvite: () => this.showInvite(),
      onDecide: (userId, approve) => this.decideRequest(userId, approve),
    });
    this.watchRequests(space);
    this.accountBar = createAccountBar(session.user.name, {
      onPeople: () => this.people?.toggle(),
      onSwitchSpace: () => this.switchSpace(),
      onSettings: () => this.showSettings(),
      onSignOut: () => this.signOut(),
    });
    this.people.setOnline(new Set([session.user.id]));
    void this.loadMembers();

    this.me = this.spawnPlayer(SPAWN.x, SPAWN.y, session.user.name, session.user.look);
    // A small dead zone stops the view from twitching on every step; the lerp eases the rest.
    this.followMe();
    void this.connect();
  }

  // A saved session is reused; if the server cannot be reached we trust it and play offline.
  private async signIn(): Promise<AuthSession> {
    const saved = loadSession();
    if (saved) {
      try {
        const user = await this.auth.me(saved.token);
        if (user) return this.remember({ token: saved.token, user });
      } catch {
        // Unreachable or erroring server is not proof the token is bad.
        return saved;
      }
      clearSession();
    }
    return promptAuth(async (mode, fields) =>
      this.remember(
        mode === "register" ? await this.auth.register(fields) : await this.auth.login(fields),
      ),
    );
  }

  // The space you used last opens straight away; "Switch space" clears that to show the list.
  private async pickSpace(session: AuthSession): Promise<SpaceSummary> {
    const token = () => session.token;
    const load = async () => {
      try {
        return await this.spaces.list(token());
      } catch (err) {
        if (err instanceof AuthRequestError && err.status === 401) this.signOut();
        throw err;
      }
    };
    const invited = await this.useInvite(session);
    if (invited) {
      saveLastSpace(session.user.id, invited.id);
      return invited;
    }
    const lastId = loadLastSpace(session.user.id);
    if (lastId) {
      try {
        const last = (await load()).find((s) => s.id === lastId);
        if (last) return last;
      } catch {
        // Fall through to the picker, which shows the error and lets people retry.
      }
    }
    this.setGameInput(false);
    const space = await chooseSpace({
      load,
      create: (name) => this.spaces.create(token(), { name }),
    });
    this.setGameInput(true);
    saveLastSpace(session.user.id, space.id);
    return space;
  }

  // Opening a link: ask first, since a link in a message is not a promise anyone meant to join.
  private async useInvite(session: AuthSession): Promise<SpaceSummary | undefined> {
    const invite = this.inviteToken;
    if (!invite) return undefined;
    try {
      const preview = await this.spaces.previewInvite(session.token, invite);
      if (!preview.alreadyMember) {
        this.setGameInput(false);
        const yes = await confirmDialog({
          title: `Join ${preview.spaceName}?`,
          body: preview.requiresApproval
            ? "An admin will have to let you in after you ask."
            : "You will be added to this space right away.",
          confirmLabel: preview.requiresApproval ? "Ask to join" : "Join",
        });
        this.setGameInput(true);
        if (!yes) return undefined;
      }
      const result = await this.spaces.acceptInvite(session.token, invite);
      if (result.status === "joined") return result.space;
      this.toast.show(
        `Asked to join ${result.spaceName}. An admin will let you in.`,
        "success",
        6000,
      );
    } catch (err) {
      this.toast.show(
        err instanceof Error ? err.message : "Could not use that link",
        "error",
        6000,
      );
    }
    return undefined;
  }

  private showInvite() {
    const { session, space } = this;
    if (!session || !space || this.closeInvite) return;
    this.setGameInput(false);
    this.closeInvite = openInviteDialog(
      {
        create: (options) => this.spaces.createInvite(session.token, space.id, options),
        list: () => this.spaces.listInvites(session.token, space.id),
        revoke: (id) => this.spaces.revokeInvite(session.token, space.id, id),
        link: (token) => buildInviteLink(inviteBase(), token),
      },
      () => {
        this.closeInvite = undefined;
        this.setGameInput(true);
      },
    );
  }

  // Owners and admins find out about people waiting at the door without having to look.
  private watchRequests(space: SpaceSummary) {
    const manage = canManageMembers(space.role);
    this.people?.setCanManage(manage);
    if (!manage) return;
    const poll = async () => {
      const session = this.session;
      if (!session) return;
      try {
        const requests = await this.spaces.listRequests(session.token, space.id);
        this.people?.setRequests(requests);
        if (requests.length > this.requestCount) {
          this.toast.show(this.waitingMessage(requests), "info", 5000);
        }
        this.requestCount = requests.length;
      } catch {
        // Next poll will try again.
      }
    };
    void poll();
    this.requestTimer = this.time.addEvent({ delay: 30_000, loop: true, callback: poll });
  }

  private waitingMessage(requests: readonly JoinRequest[]) {
    return requests.length === 1
      ? `${requests[0]!.name} wants to join`
      : `${requests.length} people want to join`;
  }

  private async decideRequest(userId: string, approve: boolean) {
    const { session, space } = this;
    if (!session || !space) return;
    try {
      await this.spaces.decideRequest(session.token, space.id, userId, approve);
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : "Could not save that", "error", 4000);
      throw err;
    }
    this.requestCount = Math.max(0, this.requestCount - 1);
    void this.refreshRequests();
    if (approve) void this.loadMembers();
  }

  private async refreshRequests() {
    const { session, space } = this;
    if (!session || !space) return;
    try {
      this.people?.setRequests(await this.spaces.listRequests(session.token, space.id));
    } catch {
      // Shown stale until the next poll.
    }
  }

  private switchSpace() {
    forgetLastSpace();
    window.location.reload();
  }

  private async loadMembers() {
    const { session, space } = this;
    if (!session || !space) return;
    try {
      this.members = await this.spaces.members(session.token, space.id);
      this.people?.setMembers(this.members);
    } catch (err) {
      console.warn("could not load members", err);
    }
  }

  private refreshOnline() {
    if (!this.session) return;
    this.people?.setOnline(new Set([this.session.user.id, ...this.accounts.values()]));
  }

  // Walks toward a person who is online, the way a click on the floor would.
  private goToUser(userId: string) {
    const me = this.me;
    if (!me) return;
    for (const [sessionId, id] of this.accounts) {
      const sprite = id === userId ? this.others.get(sessionId) : undefined;
      if (!sprite) continue;
      const route = findPath(this.grid, me, sprite, PLAYER_RADIUS);
      if (route.length > 0) {
        this.followMe();
        this.running = true;
        this.route = route;
      }
      return;
    }
  }

  private remember(session: AuthSession): AuthSession {
    saveSession(session);
    return session;
  }

  // Off while a form is open. Disabling the plugin is not enough: Phaser still swallows keys it
  // captured (arrows, WASD), so those letters could not be typed into a text field.
  private setGameInput(on: boolean) {
    const keyboard = this.input.keyboard!;
    keyboard.enabled = on;
    // A key released while input was off never reported its keyup, so it would read as held
    // forever (up and down both "held" cancel out, and the character only moves sideways).
    keyboard.resetKeys();
    if (on) keyboard.enableGlobalCapture();
    else keyboard.disableGlobalCapture();
  }

  private showSettings() {
    const session = this.session;
    if (!session || this.closeSettings) return;
    // Arrow keys and WASD belong to the form while it is open, not to the avatar.
    this.setGameInput(false);
    this.closeSettings = openSettings(
      {
        settings: this.settings,
        defaults: this.defaults,
        onSettingsChange: (next) => this.applySettings(next),
        listDevices: listMediaDevices,
        account: { profile: session.user, actions: this.accountActions() },
      },
      () => {
        this.closeSettings = undefined;
        this.setGameInput(true);
      },
    );
  }

  // Desks come from the map's object layer; the server reads the same layer to check claims.
  private setUpTables(map: Phaser.Tilemaps.Tilemap) {
    this.tables = (map.getObjectLayer(TABLES_LAYER)?.objects ?? []).map((o) => ({
      id: String(o.id),
      name: o.name || `Desk ${o.id}`,
      x: o.x ?? 0,
      y: o.y ?? 0,
      width: o.width ?? TILE_SIZE,
      height: o.height ?? TILE_SIZE,
    }));
    this.tablePromptView = createTablePrompt({
      onClaim: (tableId) => void this.claimTable(tableId),
      onRelease: () => void this.releaseTable(),
    });
  }

  private setClaims(list: readonly TableClaimSnapshot[]) {
    this.claims = new Map(list.map((c) => [c.tableId, { userId: c.userId, name: c.name }]));
    for (const table of this.tables) {
      const claim = this.claims.get(table.id);
      let label = this.tableLabels.get(table.id);
      if (!claim) {
        label?.setVisible(false);
        continue;
      }
      // On the desk top, under players so you can still walk in front of it.
      label ??= this.add
        .text(table.x + table.width / 2, table.y + TILE_SIZE * 1.5, "", {
          color: "#ffffff",
          fontSize: "11px",
          stroke: "#0b0d14",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(5);
      this.tableLabels.set(table.id, label);
      label.setText(claim.name).setVisible(true);
    }
    this.lastTablePrompt = 0;
  }

  // The nearest person in range gets the wave; the room checks the same range again.
  private refreshWave(me: Position) {
    const others = [...this.others].map(([id, s]) => ({ id, x: s.x, y: s.y }));
    const nearest = sortByDistance(me, others, nearbyIds(me, others, WAVE_RANGE))[0];
    this.waveTarget = nearest;
    const name = nearest
      ? this.members.find((m) => m.userId === this.accounts.get(nearest))?.name
      : undefined;
    this.waveButton?.show(nearest ? (name ?? "them") : undefined);
  }

  private waveAtTarget() {
    const { connection, waveTarget } = this;
    if (!connection || !waveTarget) return;
    connection.wave(waveTarget);
  }

  private refreshTablePrompt(me: Position) {
    const userId = this.session?.user.id;
    if (!userId) return;
    this.tablePromptView?.show(tablePrompt(this.tables, this.claims, userId, me));
  }

  private async claimTable(tableId: string) {
    const connection = this.connection;
    if (!connection) return;
    this.tablePromptView?.setBusy(true);
    try {
      await connection.claimTable(tableId);
      const name = this.tables.find((t) => t.id === tableId)?.name ?? "The desk";
      this.toast.show(`${name} is yours`, "success", 2500);
    } catch (err) {
      this.toast.show(
        err instanceof Error ? err.message : "Could not claim that desk",
        "error",
        3500,
      );
    } finally {
      this.tablePromptView?.setBusy(false);
    }
  }

  private async releaseTable() {
    const connection = this.connection;
    if (!connection) return;
    this.tablePromptView?.setBusy(true);
    try {
      await connection.releaseTable();
    } catch (err) {
      this.toast.show(
        err instanceof Error ? err.message : "Could not release that desk",
        "error",
        3500,
      );
    } finally {
      this.tablePromptView?.setBusy(false);
    }
  }

  private spawnPlayer(x: number, y: number, name: string, look: Look) {
    const player = new PlayerSprite(this, x, y, name, look);
    player.setNameVisible(this.settings.showNames);
    return player;
  }

  // Only once you are in the world: the sign-in screen has nothing to zoom.
  private setZoom(zoom: number) {
    if (!this.me) return;
    this.viewZoom = zoom;
    this.applySettings({ ...this.settings, zoom });
  }

  // A pinch zooms smoothly and is not saved; the saved zoom is still one of the steady levels.
  private pinchZoom(deltaY: number, x: number, y: number) {
    if (!this.me) return;
    const camera = this.cameras.main;
    const before = camera.zoom;
    this.viewZoom = zoomByWheel(this.viewZoom, deltaY);
    this.applyGraphics();
    // Following, the view stays on you. Panned away, keep the spot under the fingers in place.
    if (!this.looseCamera) return;
    const center = anchorCenter(
      { x: camera.scrollX + camera.width / 2, y: camera.scrollY + camera.height / 2 },
      { x: x - this.scale.width / 2, y: y - this.scale.height / 2 },
      before,
      camera.zoom,
    );
    camera.centerOn(center.x, center.y);
  }

  // A small dead zone stops the view from twitching on every step; the lerp eases the rest.
  private followMe() {
    if (!this.me) return;
    this.cameras.main.startFollow(this.me, true, 0.1, 0.1).setDeadzone(24, 16);
    this.looseCamera = false;
  }

  private panCamera(dx: number, dy: number) {
    const camera = this.cameras.main;
    if (!this.looseCamera) {
      camera.stopFollow();
      this.looseCamera = true;
    }
    const next = panBy({ x: camera.scrollX, y: camera.scrollY }, { x: dx, y: dy }, camera.zoom);
    camera.setScroll(next.x, next.y);
  }

  private applyGraphics() {
    const camera = this.cameras.main;
    const bounds = camera.getBounds();
    // Never smaller than the map, or a big window would show an empty border around it.
    camera.setZoom(effectiveZoom(this.viewZoom, this.scale, bounds));
    this.game.loop.targetFps = this.settings.maxFps;
  }

  private applySettings(next: Settings) {
    const prev = this.settings;
    this.settings = next;
    saveSettings(next);
    if (next.zoom !== prev.zoom) this.viewZoom = next.zoom;
    this.applyGraphics();
    if (next.showNames !== prev.showNames) {
      this.me?.setNameVisible(next.showNames);
      for (const other of this.others.values()) other.setNameVisible(next.showNames);
    }
    this.voicePanel.setVolume(next.volume);
    if (next.micDeviceId !== prev.micDeviceId)
      void this.voice?.setDevice("audioinput", next.micDeviceId);
    if (next.cameraDeviceId !== prev.cameraDeviceId) {
      void this.voice?.setDevice("videoinput", next.cameraDeviceId);
    }
    if (next.speakerDeviceId !== prev.speakerDeviceId) {
      void this.voice?.setDevice("audiooutput", next.speakerDeviceId);
    }
  }

  // Edits go over HTTP; the room is then told to copy the stored name and look into its state.
  private accountActions() {
    const token = () => this.session!.token;
    const adopt = (user: AuthSession["user"]) => {
      this.session = this.remember({ token: token(), user });
      this.me?.setProfile(user.name, user.look);
      this.accountBar?.setName(user.name);
      this.connection?.refreshProfile();
      return user;
    };
    return {
      updateProfile: async (name: string, look: Look) =>
        adopt(await this.auth.updateProfile(token(), { name, look })),
      changeEmail: async (email: string, currentPassword: string) =>
        adopt(await this.auth.changeEmail(token(), { email, currentPassword })),
      changePassword: async (currentPassword: string, newPassword: string) => {
        this.session = this.remember(
          await this.auth.changePassword(token(), { currentPassword, newPassword }),
        );
      },
      signOutOthers: async () => {
        this.session = this.remember(await this.auth.signOutOthers(token()));
      },
      deleteAccount: async (password: string) => {
        await this.auth.deleteAccount(token(), { password });
        this.signOut();
      },
    };
  }

  // A reload is the simplest way to drop every sprite, connection and call at once.
  private signOut() {
    clearSession();
    window.location.reload();
  }

  // Movement works offline; the connection only adds other players and sync.
  private async connect() {
    if (this.connecting || !this.session || !this.space) return;
    this.connecting = true;
    try {
      const connection = await connectToVoid(SERVER_URL, {
        token: this.session.token,
        spaceId: this.space.id,
      });
      this.connection = connection;
      this.unsent = true;
      if (this.wasOffline) this.toast.show("Back online", "success", 2500);
      else this.toast.hide();
      this.wasOffline = false;

      connection.onPlayerAdd((p) => {
        if (p.id === connection.sessionId) {
          // The server knows where we last stood in this space; start there.
          this.me?.setPosition(p.x, p.y);
          this.route = [];
          return;
        }
        this.others.set(p.id, this.spawnPlayer(p.x, p.y, p.name, p.look));
        this.accounts.set(p.id, p.userId);
        this.refreshOnline();
        // Someone who joined the space after we loaded the list.
        if (!this.members.some((m) => m.userId === p.userId)) void this.loadMembers();
      });
      // A move the server refused (a wall, or faster than anyone walks): go back to where it has us.
      connection.onSnap((pos) => {
        this.me?.setPosition(pos.x, pos.y);
        this.route = [];
        this.unsent = false;
      });
      connection.onPlayerMove((p) => {
        const sprite = this.others.get(p.id);
        if (!sprite) return;
        sprite.setProfile(p.name, p.look);
        const dx = p.x - sprite.x;
        const dy = p.y - sprite.y;
        // The same message also carries name changes; only a real move counts as a step.
        if (Math.hypot(dx, dy) > 0.5) sprite.step(dx, dy);
        this.tweens.add({ targets: sprite, x: p.x, y: p.y, duration: REMOTE_TWEEN_MS });
      });
      connection.onPlayerRemove((id) => this.removeOther(id));
      connection.onWaved((wave) => {
        const sprite =
          wave.fromId === connection.sessionId ? this.me : this.others.get(wave.fromId);
        sprite?.wave();
        if (wave.toId === connection.sessionId) {
          this.toast.show(`${wave.name} waved at you 👋`, "info", 3500);
        }
      });
      connection.onClaims((claims) => this.setClaims(claims));
      void this.startVoice(connection);
      connection.onDrop(() => {
        this.toast.show("Connection lost. Reconnecting…", "error");
      });
      connection.onReconnect(() => {
        this.unsent = true;
        this.toast.show("Back online", "success", 2500);
      });
      connection.onDisconnect(() => {
        this.connection = undefined;
        void this.stopVoice();
        [...this.others.keys()].forEach((id) => this.removeOther(id));
        this.wasOffline = true;
        this.toast.show("Lost connection to the server. Reconnecting…", "error");
        this.time.delayedCall(CONNECT_RETRY_MS, () => void this.connect());
      });
    } catch (err) {
      if (err instanceof NotInSpaceError) {
        // Removed from the space, or it is gone: pick again rather than retrying.
        this.switchSpace();
        return;
      }
      if (err instanceof NotSignedInError) {
        // Expired or revoked: sign in again rather than retrying with the same token.
        this.signOut();
        return;
      }
      console.error("could not connect to", SERVER_URL, err);
      this.wasOffline = true;
      this.toast.show("Can't reach the server. Retrying…", "error");
      this.time.delayedCall(CONNECT_RETRY_MS, () => void this.connect());
    } finally {
      this.connecting = false;
    }
  }

  // Voice is optional: the world keeps working if LiveKit is down or not configured.
  private async startVoice(connection: VoidConnection) {
    try {
      const voice = await connectVoice(await connection.requestVoiceToken());
      voice.onMedia((id, el, kind) => this.voicePanel.addMedia(id, el, kind));
      voice.onMediaRemoved((id, el) => this.voicePanel.removeMedia(id, el));
      voice.onPlayerGone((id) => this.voicePanel.removePlayer(id));
      voice.onLocalVideo((el) => this.voicePanel.setLocalVideo(el));
      voice.onLocalScreen((on) => this.voicePanel.setScreenSharing(on));
      voice.onDisconnect(() => {
        this.voice = undefined;
        this.voicePanel.setEnabled(false);
        this.toast.show("Voice disconnected", "error", 3000);
      });
      this.voice = voice;
      this.nearby = new Set();
      // Remembered devices apply to the next time the mic or camera is switched on.
      const { micDeviceId, cameraDeviceId, speakerDeviceId } = this.settings;
      if (micDeviceId) void voice.setDevice("audioinput", micDeviceId);
      if (cameraDeviceId) void voice.setDevice("videoinput", cameraDeviceId);
      if (speakerDeviceId) void voice.setDevice("audiooutput", speakerDeviceId);
      this.voicePanel.setEnabled(true);
    } catch (err) {
      console.warn("voice unavailable", err);
    }
  }

  // Arrow keys belong to the picker while it is open, not to the avatar.
  private async pickScreen(bridge: DesktopBridge) {
    this.setGameInput(false);
    try {
      await chooseScreenSource(bridge);
    } finally {
      this.setGameInput(true);
    }
  }

  private async stopVoice() {
    const voice = this.voice;
    this.voice = undefined;
    this.nearby = new Set();
    this.voicePanel.setEnabled(false);
    await voice?.leave();
  }

  private updateProximity(me: PlayerSprite) {
    const others = [...this.others].map(([id, s]) => ({ id, x: s.x, y: s.y }));
    this.nearby = nearbyIds(me, others, this.settings.proximityTiles * TILE_SIZE, this.nearby);
    this.voice?.setNearby(sortByDistance(me, others, this.nearby));
  }

  private removeOther(id: string) {
    this.others.get(id)?.destroy();
    this.others.delete(id);
    this.accounts.delete(id);
    this.refreshOnline();
  }

  // A click on the world: walk there, round walls. Overlays sit above the canvas and take their
  // own clicks, so this only sees clicks on the map.
  // A press that stays put is a click and walks on release; one that moves drags the map instead.
  private pressMap(pointer: Phaser.Input.Pointer) {
    if (!pointer.leftButtonDown()) return;
    this.press = { start: { x: pointer.x, y: pointer.y }, last: { x: pointer.x, y: pointer.y } };
  }

  private dragMap(pointer: Phaser.Input.Pointer) {
    const press = this.press;
    if (!press || !this.me || !pointer.leftButtonDown()) return;
    if (!press.dragging && !isDrag(press.start, pointer)) return;
    if (!press.dragging) this.input.setDefaultCursor("grabbing");
    press.dragging = true;
    this.panCamera(pointer.x - press.last.x, pointer.y - press.last.y);
    press.last = { x: pointer.x, y: pointer.y };
  }

  private releaseMap(pointer: Phaser.Input.Pointer) {
    const clicked = this.press && !this.press.dragging;
    this.endPress();
    if (clicked) this.walkToPoint({ x: pointer.worldX, y: pointer.worldY });
  }

  private endPress() {
    this.press = undefined;
    this.input.setDefaultCursor("default");
  }

  private walkToPoint(point: Position) {
    const me = this.me;
    if (!me) return;
    this.followMe();
    const route = findPath(this.grid, me, point, PLAYER_RADIUS);
    if (route.length === 0) return;
    this.running = false;
    this.route = route;
    const end = route[route.length - 1]!;
    const marker = this.add.circle(end.x, end.y, 6).setStrokeStyle(2, 0x8b93ff).setDepth(5);
    this.tweens.add({
      targets: marker,
      scale: 2,
      alpha: 0,
      duration: 500,
      onComplete: () => marker.destroy(),
    });
  }

  // A ring that grows out from you, for finding yourself on a big map or in a crowd.
  private showMe() {
    const me = this.me;
    if (!me) return;
    this.followMe();
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(me.x, me.y, 10).setStrokeStyle(3, 0x8b93ff).setDepth(5);
      this.tweens.add({
        targets: ring,
        scale: 5,
        alpha: 0,
        delay: i * 250,
        duration: 800,
        onComplete: () => ring.destroy(),
      });
    }
  }

  update(time: number, delta: number) {
    const me = this.me;
    if (!me) return;

    const { keys, wasd } = this;
    const dir = readDirection(
      {
        arrows: {
          up: keys.up.isDown,
          down: keys.down.isDown,
          left: keys.left.isDown,
          right: keys.right.isDown,
        },
        wasd: { up: wasd.W.isDown, down: wasd.S.isDown, left: wasd.A.isDown, right: wasd.D.isDown },
      },
      this.settings.keys,
    );
    const speed = this.running && this.route.length > 0 ? PLAYER_RUN_SPEED : PLAYER_SPEED;
    // Pressing a movement key takes over from a click.
    if (dir.dx || dir.dy) {
      this.route = [];
      if (this.looseCamera) this.followMe();
    } else if (this.route.length > 0) {
      const walk = followPath(this.route, me, speed * (delta / 1000));
      this.route = walk.rest;
      dir.dx = walk.dx;
      dir.dy = walk.dy;
    }
    if (dir.dx || dir.dy) {
      const target = stepPosition(me, dir, speed, delta);
      const next = moveWithCollision(this.grid, me, target, PLAYER_RADIUS);
      if (next.x !== me.x || next.y !== me.y) {
        me.step(dir.dx, dir.dy);
        me.setPosition(next.x, next.y);
        this.unsent = true;
      } else {
        // Something is in the way (another wall edge or a bad route): stop instead of pushing.
        this.route = [];
      }
    }
    me.tick(time);
    for (const other of this.others.values()) other.tick(time);

    if (this.minimap && time - this.lastMinimap > 100) {
      this.lastMinimap = time;
      this.minimap.draw({
        me,
        others: [...this.others.values()],
        view: this.cameras.main.worldView,
      });
    }

    if (time - this.lastTablePrompt > 150) {
      this.lastTablePrompt = time;
      this.refreshTablePrompt(me);
      this.refreshWave(me);
    }

    if (this.voice && time - this.lastProximity > PROXIMITY_CHECK_MS) {
      this.lastProximity = time;
      this.updateProximity(me);
    }

    // Throttled, but also flushes the final position after the player stops.
    if (this.connection && this.unsent && time - this.lastSent > MOVE_SEND_INTERVAL_MS) {
      this.lastSent = time;
      this.unsent = false;
      this.connection.sendMove({ x: me.x, y: me.y });
    }
  }
}
