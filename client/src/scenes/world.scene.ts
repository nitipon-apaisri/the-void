// lib
import Phaser from "phaser";

// shared
import {
  findSpawn,
  mapName,
  TILE_SIZE,
  SEATS_LAYER,
  SIT_RANGE,
  TABLES_LAYER,
  furnitureSeats,
  isSeatFacing,
  nearestFreeSeat,
  type Seat,
  canEmptySpace,
  findFurniture,
  fullRect,
  placementError,
  setBlocked,
  type FurnitureItem,
  type PlacedFurniture,
  WAVE_RANGE,
  canManageMembers,
  type AuthSession,
  type DesktopBridge,
  type JoinRequest,
  type Look,
  type MapTable,
  type Position,
  type InviteResult,
  type SpaceMember,
  type SpaceRole,
  type SpaceSummary,
  type SpaceSize,
  type SpaceTemplate,
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
import { audibleSpeakers } from "../systems/speaking";
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
import { chooseSpace, type MapPreview } from "../ui/space-picker";
import { openSettings } from "../ui/settings-window";
import { createDecoratePanel, type DecoratePanel, type DecorateTool } from "../ui/decorate-panel";
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

const mapUrls = import.meta.glob("../assets/maps/*.tmj", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const pendingMessage = (spaceName: string) =>
  `Asked to join ${spaceName}. An admin will let you in.`;

export class WorldScene extends Phaser.Scene {
  private connection?: VoidConnection;
  private connecting = false;
  private wasOffline = false;
  private removed = false;
  private toast!: Toast;
  private voicePanel!: VoicePanel;
  private voice?: VoiceConnection;
  private nearby: ReadonlySet<string> = new Set();
  // Who LiveKit says is talking; shown only for people in hearing range (see showSpeaking).
  private speaking: ReadonlySet<string> = new Set();
  private selfSpeaking = false;
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
  private decorate?: DecoratePanel;
  private tool?: DecorateTool;
  // The map's own walls, so placed furniture can be added on top and taken off again.
  private baseBlocked: boolean[] = [];
  private pieces = new Map<string, PlacedFurniture>();
  private readonly pieceImages = new Map<string, Phaser.GameObjects.Image[]>();
  private ghost?: Phaser.GameObjects.Image;
  private ghostSpot?: { col: number; row: number };
  private hoverBox?: Phaser.GameObjects.Rectangle;
  private seats: Seat[] = [];
  // Seat id by session, from room state, to know which seats are taken.
  private readonly seatOf = new Map<string, string>();
  private mySeat?: Seat;
  private standing = false;
  private sitPending = false;
  // After standing up, the seat you left stays off until you walk away from it, so you are not
  // sat straight back down.
  private suppressSeat?: Seat;
  private lastMoveAt = 0;
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
    for (const [file, url] of Object.entries(mapUrls)) {
      this.load.tilemapTiledJSON(`map:${file.split("/").pop()!.replace(".tmj", "")}`, url);
    }
    for (const [name, url] of Object.entries(tilesetUrls)) this.load.image(name, url);
  }

  create() {
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
      this.decorate?.destroy();
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

  // The map depends on the space's template and size, so it is built once the space is known.
  private buildWorld(template: SpaceTemplate, size: SpaceSize) {
    const map = this.make.tilemap({ key: `map:${mapName(template, size)}` });
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
    this.setUpSeats(map);
    this.baseBlocked = [...this.grid.blocked];
    this.decorate = createDecoratePanel({
      onToggle: (open) => {
        if (!open) this.setTool(undefined);
      },
      onTool: (tool) => this.setTool(tool),
      onReset: () => void this.resetDecorations(),
    });
    this.input.keyboard!.on("keydown-ESC", () => this.decorate?.close());
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
  }

  private async enter() {
    // The form's text input must receive arrow keys, so pause game input while it is open.
    this.setGameInput(false);
    const session = await this.signIn();
    this.session = session;
    this.setGameInput(true);
    const space = await this.pickSpace(session);
    this.space = space;
    this.buildWorld(space.template, space.size);
    const spawn = findSpawn(this.grid, PLAYER_RADIUS);
    this.people = createPeoplePanel({
      onGoTo: (userId) => this.goToUser(userId),
      onTyping: (on) => this.setGameInput(!on),
      onToggle: (open) => this.accountBar?.setPeopleOpen(open),
      onInvite: () => this.showInvite(),
      onDecide: (userId, approve) => this.decideRequest(userId, approve),
      onSetRole: (member, role) => this.changeRole(member, role),
      onRemove: (member) => this.removeMember(member),
      onBan: (member) => this.banMember(member),
      onUnban: (userId) => this.unbanMember(userId),
      onLeave: () => void this.leaveSpace(),
    });
    this.people.setViewer(session.user.id, space.role);
    this.watchRequests(space);
    this.accountBar = createAccountBar(session.user.name, {
      onPeople: () => this.people?.toggle(),
      onSwitchSpace: () => this.switchSpace(),
      onSettings: () => this.showSettings(),
      onSignOut: () => this.signOut(),
    });
    this.people.setOnline(new Set([session.user.id]));
    void this.loadMembers();
    void this.loadBans();

    this.me = this.spawnPlayer(spawn.x, spawn.y, session.user.name, session.user.look);
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
      create: (name, template, size) => this.spaces.create(token(), { name, template, size }),
      preview: (template, size) => this.previewMap(template, size),
      redeem: (code) => this.redeemInvite(session, code),
    });
    this.setGameInput(true);
    saveLastSpace(session.user.id, space.id);
    return space;
  }

  // The thumbnail in the space picker: the walls of a template's map, read before the scene
  // has loaded it into Phaser.
  private async previewMap(
    template: SpaceTemplate,
    size: SpaceSize,
  ): Promise<MapPreview | undefined> {
    const file = `/${mapName(template, size)}.tmj`;
    const url = Object.entries(mapUrls).find(([path]) => path.endsWith(file))?.[1];
    if (!url) return undefined;
    try {
      const map = (await (await fetch(url)).json()) as {
        width: number;
        height: number;
        layers: { name: string; data?: number[] }[];
      };
      const data = map.layers.find((l) => l.name === "collision")?.data;
      if (!data) return undefined;
      return {
        cols: map.width,
        rows: map.height,
        blocked: (col, row) => data[row * map.width + col]! > 0,
      };
    } catch {
      return undefined;
    }
  }

  // Opening a link: ask first, since a link in a message is not a promise anyone meant to join.
  private async useInvite(session: AuthSession): Promise<SpaceSummary | undefined> {
    const invite = this.inviteToken;
    if (!invite) return undefined;
    try {
      const result = await this.redeemInvite(session, invite);
      if (result?.status === "joined") return result.space;
      if (result) this.toast.show(pendingMessage(result.spaceName), "success", 6000);
    } catch (err) {
      this.toast.show(
        err instanceof Error ? err.message : "Could not use that link",
        "error",
        6000,
      );
    }
    return undefined;
  }

  // A link or a typed code: the same steps. Undefined when the person says no; throws a message
  // that is safe to show when the invite is no good.
  private async redeemInvite(
    session: AuthSession,
    invite: string,
  ): Promise<InviteResult | undefined> {
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
    return this.spaces.acceptInvite(session.token, invite);
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

  private async changeRole(member: SpaceMember, role: SpaceRole) {
    const { session, space } = this;
    if (!session || !space) return;
    if (role === "owner") {
      const ok = await confirmDialog({
        title: `Hand ${space.name} to ${member.name}?`,
        body: "They become the owner and you become an admin. Only they can undo it.",
        confirmLabel: "Make owner",
      });
      if (!ok) throw new Error("cancelled");
    }
    try {
      await this.spaces.setRole(session.token, space.id, member.userId, role);
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : "Could not do that", "error", 4000);
      throw err;
    }
    // Handing the space over changes our own role too; loadMembers notices and reloads.
    await this.loadMembers();
  }

  private async removeMember(member: SpaceMember) {
    const { session, space } = this;
    if (!session || !space) return;
    const ok = await confirmDialog({
      title: `Remove ${member.name}?`,
      body: "They lose access to this space and give up their desk. They can come back through an invite link; use Ban to stop that.",
      confirmLabel: "Remove",
    });
    if (!ok) throw new Error("cancelled");
    try {
      await this.spaces.removeMember(session.token, space.id, member.userId);
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : "Could not do that", "error", 4000);
      throw err;
    }
    await this.loadMembers();
  }

  private async banMember(member: SpaceMember) {
    const { session, space } = this;
    if (!session || !space) return;
    const ok = await confirmDialog({
      title: `Ban ${member.name}?`,
      body: "They are removed, give up their desk, and cannot come back or ask to join with a link or code until you unban them.",
      confirmLabel: "Ban",
    });
    if (!ok) throw new Error("cancelled");
    try {
      await this.spaces.banMember(session.token, space.id, member.userId);
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : "Could not do that", "error", 4000);
      throw err;
    }
    await Promise.all([this.loadMembers(), this.loadBans()]);
  }

  private async unbanMember(userId: string) {
    const { session, space } = this;
    if (!session || !space) return;
    try {
      await this.spaces.unbanMember(session.token, space.id, userId);
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : "Could not do that", "error", 4000);
      throw err;
    }
    this.toast.show("Unbanned. They need a new link or code to come back.", "info", 4000);
    await this.loadBans();
  }

  // Only owners and admins can read the list; it changes only when one of them acts.
  private async loadBans() {
    const { session, space } = this;
    if (!session || !space || !canManageMembers(space.role)) return;
    try {
      this.people?.setBans(await this.spaces.listBans(session.token, space.id));
    } catch {
      // Shown stale until the next change.
    }
  }

  private async leaveSpace() {
    const { session, space } = this;
    if (!session || !space) return;
    const ok = await confirmDialog({
      title: `Leave ${space.name}?`,
      body: "You give up your desk. You can come back through an invite link.",
      confirmLabel: "Leave",
    });
    if (!ok) return;
    try {
      await this.spaces.removeMember(session.token, space.id, session.user.id);
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : "Could not leave", "error", 4000);
      return;
    }
    this.switchSpace();
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
      // The owner handed the space over, or promoted or demoted us: what we may do changed.
      const mine = this.members.find((m) => m.userId === session.user.id)?.role;
      if (mine && mine !== space.role) {
        this.toast.show(
          `You are now ${mine === "member" ? "a member" : `the ${mine}`}. Reloading…`,
          "info",
          1500,
        );
        window.setTimeout(() => window.location.reload(), 1200);
      }
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
    if (this.mySeat) {
      void this.standUp().then(() => {
        if (!this.mySeat) this.goToUser(userId);
      });
      return;
    }
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

  // A frame is a cut-out of a tileset image: the whole item, or its top rows (drawn over players).
  private furnitureFrame(item: FurnitureItem, part: "full" | "under" | "over") {
    const key = `${item.id}:${part}`;
    const texture = this.textures.get(item.sheet);
    if (!texture.has(key)) {
      const over = item.over ?? 0;
      const [from, rows] =
        part === "full" ? [0, item.h] : part === "over" ? [0, over] : [over, item.h - over];
      texture.add(
        key,
        0,
        item.sx * TILE_SIZE,
        (item.sy + from) * TILE_SIZE,
        item.w * TILE_SIZE,
        rows * TILE_SIZE,
      );
    }
    return key;
  }

  private drawPiece(item: FurnitureItem, piece: PlacedFurniture) {
    const over = item.over ?? 0;
    const x = piece.col * TILE_SIZE;
    const y = piece.row * TILE_SIZE;
    // Under players, above the map's own floor and objects; a rug sits lowest.
    const images = [
      this.add
        .image(x, y + over * TILE_SIZE, item.sheet, this.furnitureFrame(item, "under"))
        .setOrigin(0)
        .setDepth(item.block ? 4 : 3),
    ];
    if (over > 0) {
      images.push(
        this.add
          .image(x, y, item.sheet, this.furnitureFrame(item, "over"))
          .setOrigin(0)
          .setDepth(20),
      );
    }
    return images;
  }

  // The room sends every piece; draw what is new, drop what is gone, and rebuild the walls.
  private syncFurniture(list: readonly PlacedFurniture[]) {
    const next = new Map(list.map((p) => [p.id, p]));
    for (const [id, images] of this.pieceImages) {
      if (next.has(id)) continue;
      images.forEach((image) => image.destroy());
      this.pieceImages.delete(id);
    }
    this.grid.blocked = [...this.baseBlocked];
    for (const piece of list) {
      const item = findFurniture(piece.itemId);
      if (!item) continue;
      if (!this.pieceImages.has(piece.id))
        this.pieceImages.set(piece.id, this.drawPiece(item, piece));
      setBlocked(this.grid, item, piece.col, piece.row, true);
    }
    this.pieces = next;
    this.minimap?.refresh();
  }

  private furnitureError(item: FurnitureItem, col: number, row: number) {
    const people = [this.me, ...this.others.values()].filter((p) => p !== undefined);
    return placementError(this.grid, item, col, row, {
      people,
      personRadius: PLAYER_RADIUS,
      tables: this.tables,
    });
  }

  private setTool(tool: DecorateTool | undefined) {
    this.tool = tool;
    this.ghost?.destroy();
    this.hoverBox?.destroy();
    this.ghost = this.hoverBox = this.ghostSpot = undefined;
    if (tool?.kind === "item") {
      const { item } = tool;
      this.ghost = this.add
        .image(0, 0, item.sheet, this.furnitureFrame(item, "full"))
        .setOrigin(0)
        .setDepth(30)
        .setAlpha(0.8)
        .setVisible(false);
    } else if (tool?.kind === "remove") {
      this.hoverBox = this.add
        .rectangle(0, 0, 0, 0)
        .setOrigin(0)
        .setStrokeStyle(2, 0xff6b81)
        .setDepth(30)
        .setVisible(false);
    }
  }

  private pieceAt(x: number, y: number) {
    for (const piece of [...this.pieces.values()].reverse()) {
      const item = findFurniture(piece.itemId);
      if (!item) continue;
      const r = fullRect(item, piece.col, piece.row);
      if (
        x >= r.col * TILE_SIZE &&
        x < (r.col + r.w) * TILE_SIZE &&
        y >= r.row * TILE_SIZE &&
        y < (r.row + r.h) * TILE_SIZE
      ) {
        return piece;
      }
    }
    return undefined;
  }

  // Follows the pointer: the piece to place snaps to the grid (red if it would not fit), or the
  // piece under the pointer is outlined for removal.
  private updateGhost(pointer: Phaser.Input.Pointer) {
    const tool = this.tool;
    if (tool?.kind === "item" && this.ghost) {
      const { item } = tool;
      const col = Math.round(pointer.worldX / TILE_SIZE - item.w / 2);
      const row = Math.round(pointer.worldY / TILE_SIZE - item.h / 2);
      this.ghostSpot = { col, row };
      const bad = this.furnitureError(item, col, row);
      this.ghost.setPosition(col * TILE_SIZE, row * TILE_SIZE).setVisible(true);
      if (bad) this.ghost.setTint(0xff6b81);
      else this.ghost.clearTint();
    } else if (tool?.kind === "remove" && this.hoverBox) {
      const piece = this.pieceAt(pointer.worldX, pointer.worldY);
      const item = piece && findFurniture(piece.itemId);
      if (!piece || !item) {
        this.hoverBox.setVisible(false);
        return;
      }
      this.hoverBox
        .setPosition(piece.col * TILE_SIZE, piece.row * TILE_SIZE)
        .setSize(item.w * TILE_SIZE, item.h * TILE_SIZE)
        .setVisible(true);
    }
  }

  private async useTool(pointer: Phaser.Input.Pointer) {
    const { tool, connection } = this;
    if (!tool || !connection) return;
    this.updateGhost(pointer);
    try {
      if (tool.kind === "item") {
        const spot = this.ghostSpot;
        if (!spot) return;
        const error = this.furnitureError(tool.item, spot.col, spot.row);
        if (error) {
          this.toast.show(error, "error", 2000);
          return;
        }
        await connection.placeFurniture({ itemId: tool.item.id, ...spot });
      } else {
        const piece = this.pieceAt(pointer.worldX, pointer.worldY);
        if (piece) await connection.removeFurniture(piece.id);
      }
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : "Could not do that", "error", 2500);
    }
  }

  private async resetDecorations() {
    try {
      await this.connection?.clearFurniture();
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : "Could not do that", "error", 2500);
    }
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
        const sprite = this.spawnPlayer(p.x, p.y, p.name, p.look);
        sprite.setSeated(p.seat ? p.facing : undefined);
        if (p.seat) this.seatOf.set(p.id, p.seat);
        this.others.set(p.id, sprite);
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
        if (p.seat) this.seatOf.set(p.id, p.seat);
        else this.seatOf.delete(p.id);
        // The room stood us up (the chair was removed): forget the seat here too.
        if (p.id === connection.sessionId && this.mySeat && !p.seat) this.leaveSeat();
        const sprite = this.others.get(p.id);
        if (!sprite) return;
        sprite.setSeated(p.seat ? p.facing : undefined);
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
      connection.onMembersChanged(() => void this.loadMembers());
      connection.onRemoved(() => {
        this.removed = true;
        forgetLastSpace();
        this.toast.show(`You were removed from ${this.space?.name ?? "this space"}`, "error", 4000);
        window.setTimeout(() => window.location.reload(), 2000);
      });
      connection.onSpaceReset(() => {
        // The map changed under us; a fresh load rebuilds it from the stored template.
        this.toast.show("This space was emptied. Reloading…", "info", 1500);
        window.setTimeout(() => window.location.reload(), 800);
      });
      connection.onClaims((claims) => this.setClaims(claims));
      connection.onFurniture((pieces) => this.syncFurniture(pieces));
      this.decorate?.setAvailable(true, this.space ? canEmptySpace(this.space.role) : false);
      void this.startVoice(connection);
      connection.onDrop(() => {
        this.toast.show("Connection lost. Reconnecting…", "error");
      });
      connection.onReconnect(() => {
        this.unsent = true;
        this.toast.show("Back online", "success", 2500);
      });
      connection.onDisconnect(() => {
        // Removed from the space: the page reloads to the picker, so do not try to reconnect.
        if (this.removed) return;
        this.seatOf.clear();
        this.leaveSeat();
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
      voice.onSpeakers((remote, self) => {
        this.speaking = remote;
        this.selfSpeaking = self;
        this.showSpeaking();
      });
      voice.onDisconnect(() => {
        this.voice = undefined;
        this.clearSpeaking();
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
    this.clearSpeaking();
    this.voicePanel.setEnabled(false);
    await voice?.leave();
  }

  // The ring and the video highlight follow who is talking and who is close enough to hear.
  private showSpeaking() {
    const heard = audibleSpeakers(this.speaking, this.nearby);
    for (const [id, sprite] of this.others) sprite.setSpeaking(heard.has(id));
    this.me?.setSpeaking(this.selfSpeaking);
    this.voicePanel.setSpeaking(heard, this.selfSpeaking);
  }

  private clearSpeaking() {
    this.speaking = new Set();
    this.selfSpeaking = false;
    this.showSpeaking();
  }

  private updateProximity(me: PlayerSprite) {
    const others = [...this.others].map(([id, s]) => ({ id, x: s.x, y: s.y }));
    this.nearby = nearbyIds(me, others, this.settings.proximityTiles * TILE_SIZE, this.nearby);
    this.voice?.setNearby(sortByDistance(me, others, this.nearby));
    // Walking out of range stops the ring even if they keep talking.
    this.showSpeaking();
  }

  // Places to sit, from the map's "seats" layer. Desk chairs have no art; the others are tiles.
  private setUpSeats(map: Phaser.Tilemaps.Tilemap) {
    this.seats = [];
    for (const o of map.getObjectLayer(SEATS_LAYER)?.objects ?? []) {
      const props = (o.properties ?? []) as { name: string; value: unknown }[];
      const facing = props.find((p) => p.name === "facing")?.value;
      const art = props.find((p) => p.name === "art")?.value;
      if (!isSeatFacing(facing) || o.x === undefined || o.y === undefined) continue;
      const seat: Seat = {
        id: `s${o.id}`,
        x: o.x,
        y: o.y,
        facing,
        ...(typeof art === "string" ? { art } : {}),
      };
      this.seats.push(seat);
    }
  }

  private allSeats() {
    return [...this.seats, ...furnitureSeats(this.pieces.values())];
  }

  private autoSit(me: Position) {
    if (this.mySeat) return;
    const suppressed = this.suppressSeat;
    if (suppressed && Math.hypot(suppressed.x - me.x, suppressed.y - me.y) > SIT_RANGE + 8) {
      this.suppressSeat = undefined;
    }
    const free = nearestFreeSeat(this.allSeats(), new Set(this.seatOf.values()), me);
    // Coming to rest next to a free chair sits you down. Walking past one does not.
    const resting = this.route.length === 0 && this.time.now - this.lastMoveAt > 350;
    if (free && resting && free.id !== this.suppressSeat?.id) void this.sitDown();
  }

  private leaveSeat() {
    this.mySeat = undefined;
    this.me?.setSeated(undefined);
    this.lastTablePrompt = 0;
  }

  private async sitDown() {
    const { connection, me } = this;
    if (!connection || !me || this.mySeat || this.sitPending) return;
    const seat = nearestFreeSeat(this.allSeats(), new Set(this.seatOf.values()), me);
    if (!seat) return;
    this.sitPending = true;
    try {
      await connection.sit(seat.id);
      this.route = [];
      this.mySeat = seat;
      me.setSeated(seat.facing);
      this.followMe();
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : "Could not sit there", "error", 2500);
      // Do not retry the same seat every tick.
      this.suppressSeat = seat;
    } finally {
      this.sitPending = false;
    }
  }

  // Resolves once the room has put us back on our feet (it sends our new position).
  private async standUp() {
    const { connection } = this;
    if (!connection || !this.mySeat || this.standing) return;
    this.standing = true;
    const left = this.mySeat;
    try {
      await connection.stand();
      this.suppressSeat = left;
      this.leaveSeat();
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : "Could not stand up", "error", 2500);
    } finally {
      this.standing = false;
    }
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
    if (!this.me || !pointer.leftButtonDown()) return;
    this.press = { start: { x: pointer.x, y: pointer.y }, last: { x: pointer.x, y: pointer.y } };
  }

  private dragMap(pointer: Phaser.Input.Pointer) {
    if (this.tool) this.updateGhost(pointer);
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
    if (!clicked) return;
    // Decorating: a click places or removes a piece instead of walking.
    if (this.tool) void this.useTool(pointer);
    else this.walkToPoint({ x: pointer.worldX, y: pointer.worldY });
  }

  private endPress() {
    this.press = undefined;
    this.input.setDefaultCursor("default");
  }

  private walkToPoint(point: Position) {
    const me = this.me;
    if (!me) return;
    if (this.mySeat) {
      void this.standUp().then(() => {
        if (!this.mySeat) this.walkToPoint(point);
      });
      return;
    }
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
    if (this.mySeat) {
      // Seated: any movement key stands us up first, and nothing walks until then.
      if (dir.dx || dir.dy) void this.standUp();
      dir.dx = dir.dy = 0;
      this.route = [];
    }
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
        this.lastMoveAt = time;
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
      this.autoSit(me);
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
