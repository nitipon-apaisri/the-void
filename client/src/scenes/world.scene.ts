// lib
import Phaser from "phaser";

// shared
import { AVATAR_COUNT, SPAWN, TILE_SIZE, type AuthSession, type DesktopBridge } from "@void/shared";

// config
import {
  API_URL,
  CONNECT_RETRY_MS,
  DEFAULT_PROXIMITY_TILES,
  PROXIMITY_CHECK_MS,
  MOVE_SEND_INTERVAL_MS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  REMOTE_TWEEN_MS,
  SERVER_URL,
} from "../config/env";

// net
import { createAuthClient } from "../net/auth-client";
import { connectVoice, listMediaDevices, type VoiceConnection } from "../net/voice-connection";
import { NotSignedInError, connectToVoid, type VoidConnection } from "../net/void-connection";

// systems
import { FRAME } from "../systems/character-frames";
import { createGrid, moveWithCollision, type CollisionGrid } from "../systems/collision";
import { readDirection } from "../systems/controls";
import { stepPosition } from "../systems/movement";
import { nearbyIds, sortByDistance } from "../systems/proximity";
import { defaultSettings, type Settings } from "../systems/settings";

// objects
import { createCharacterAnimations } from "../objects/character-anims";
import { PlayerSprite } from "../objects/player";

// ui
import { createAccountBar, type AccountBar } from "../ui/account-bar";
import { promptAuth } from "../ui/auth-form";
import { chooseScreenSource } from "../ui/screen-picker";
import { openSettings } from "../ui/settings-window";
import { createToast, type Toast } from "../ui/toast";
import { createVoicePanel, type VoicePanel } from "../ui/voice-panel";

// utils
import { desktopBridge } from "../utils/desktop-bridge";
import { characterUrls, tilesetUrls } from "../utils/game-art";
import { clearSession, loadSession, saveSession } from "../utils/session";
import { loadSettings, saveSettings } from "../utils/settings-store";

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
  private session?: AuthSession;
  private accountBar?: AccountBar;
  private me?: PlayerSprite;
  private others = new Map<string, PlayerSprite>();
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private readonly defaults = defaultSettings(DEFAULT_PROXIMITY_TILES);
  private settings: Settings = loadSettings(this.defaults);
  private closeSettings?: () => void;
  private lastSent = 0;
  private unsent = false;

  constructor() {
    super("world");
  }

  preload() {
    this.load.tilemapTiledJSON("office", mapUrl);
    for (const [name, url] of Object.entries(tilesetUrls)) this.load.image(name, url);
    characterUrls.forEach((url, i) =>
      this.load.spritesheet(`character-${i}`, url, {
        frameWidth: FRAME.width,
        frameHeight: FRAME.height,
      }),
    );
  }

  create() {
    createCharacterAnimations(this, Math.min(AVATAR_COUNT, characterUrls.length));
    const map = this.make.tilemap({ key: "office" });
    const tilesets = map.tilesets.map((t) => map.addTilesetImage(t.name, t.name)!);
    for (const name of ["floor", "decor", "objects"]) map.createLayer(name, tilesets);
    // "collision" is never drawn: any tile in it blocks movement.
    const collision = map.getLayer("collision");
    if (!collision) throw new Error("the map has no collision layer");
    this.grid = createGrid(
      map.width,
      map.height,
      map.tileWidth,
      (col, row) => collision.data[row][col].index > 0,
    );
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.keys = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as typeof this.wasd;
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.closeSettings?.();
      void this.stopVoice();
      void this.connection?.leave();
      this.toast.destroy();
      this.voicePanel.destroy();
      this.accountBar?.destroy();
    });
    void this.enter();
  }

  private async enter() {
    // The form's text input must receive arrow keys, so pause game input while it is open.
    this.setGameInput(false);
    const session = await this.signIn();
    this.session = session;
    this.setGameInput(true);
    this.accountBar = createAccountBar(session.user.name, {
      onSettings: () => this.showSettings(),
      onSignOut: () => this.signOut(),
    });

    this.me = new PlayerSprite(this, SPAWN.x, SPAWN.y, session.user.name, session.user.avatar);
    this.cameras.main.startFollow(this.me, true, 0.15, 0.15);
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

  private remember(session: AuthSession): AuthSession {
    saveSession(session);
    return session;
  }

  // Off while a form is open. Disabling the plugin is not enough: Phaser still swallows keys it
  // captured (arrows, WASD), so those letters could not be typed into a text field.
  private setGameInput(on: boolean) {
    const keyboard = this.input.keyboard!;
    keyboard.enabled = on;
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

  private applySettings(next: Settings) {
    const prev = this.settings;
    this.settings = next;
    saveSettings(next);
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

  // Edits go over HTTP; the room is then told to copy the stored name and avatar into its state.
  private accountActions() {
    const token = () => this.session!.token;
    const adopt = (user: AuthSession["user"]) => {
      this.session = this.remember({ token: token(), user });
      this.me?.setProfile(user.name, user.avatar);
      this.accountBar?.setName(user.name);
      this.connection?.refreshProfile();
      return user;
    };
    return {
      updateProfile: async (name: string, avatar: number) =>
        adopt(await this.auth.updateProfile(token(), { name, avatar })),
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
    if (this.connecting || !this.session) return;
    this.connecting = true;
    try {
      const connection = await connectToVoid(SERVER_URL, { token: this.session.token });
      this.connection = connection;
      this.unsent = true;
      if (this.wasOffline) this.toast.show("Back online", "success", 2500);
      else this.toast.hide();
      this.wasOffline = false;

      connection.onPlayerAdd((p) => {
        if (p.id === connection.sessionId) return;
        this.others.set(p.id, new PlayerSprite(this, p.x, p.y, p.name, p.avatar));
      });
      connection.onPlayerMove((p) => {
        const sprite = this.others.get(p.id);
        if (!sprite) return;
        sprite.setProfile(p.name, p.avatar);
        const dx = p.x - sprite.x;
        const dy = p.y - sprite.y;
        // The same message also carries name changes; only a real move counts as a step.
        if (Math.hypot(dx, dy) > 0.5) sprite.step(dx, dy);
        this.tweens.add({ targets: sprite, x: p.x, y: p.y, duration: REMOTE_TWEEN_MS });
      });
      connection.onPlayerRemove((id) => this.removeOther(id));
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
    if (dir.dx || dir.dy) {
      const target = stepPosition(me, dir, PLAYER_SPEED, delta);
      const next = moveWithCollision(this.grid, me, target, PLAYER_RADIUS);
      if (next.x !== me.x || next.y !== me.y) {
        me.step(dir.dx, dir.dy);
        me.setPosition(next.x, next.y);
        this.unsent = true;
      }
    }
    me.tick(time);
    for (const other of this.others.values()) other.tick(time);

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
