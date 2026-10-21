// lib
import Phaser from "phaser";

// shared
import { PROXIMITY_RADIUS, SPAWN, type JoinOptions } from "@void/shared";

// config
import {
  CONNECT_RETRY_MS,
  PROXIMITY_CHECK_MS,
  MOVE_SEND_INTERVAL_MS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  REMOTE_TWEEN_MS,
  SERVER_URL,
} from "../config/env";

// net
import { connectVoice, type VoiceConnection } from "../net/voice-connection";
import { connectToVoid, type VoidConnection } from "../net/void-connection";

// systems
import { createGrid, moveWithCollision, type CollisionGrid } from "../systems/collision";
import { stepPosition } from "../systems/movement";
import { nearbyIds } from "../systems/proximity";

// objects
import { PlayerSprite } from "../objects/player";

// ui
import { promptProfile } from "../ui/join-form";
import { createToast, type Toast } from "../ui/toast";
import { createVoicePanel, type VoicePanel } from "../ui/voice-panel";

import mapUrl from "../assets/maps/office.tmj?url";
import tilesUrl from "../assets/maps/tileset.png";

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
  private profile?: Required<JoinOptions>;
  private me?: PlayerSprite;
  private others = new Map<string, PlayerSprite>();
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private lastSent = 0;
  private unsent = false;

  constructor() {
    super("world");
  }

  preload() {
    this.load.tilemapTiledJSON("office", mapUrl);
    this.load.image("tiles", tilesUrl);
  }

  create() {
    const map = this.make.tilemap({ key: "office" });
    const tileset = map.addTilesetImage("tiles", "tiles")!;
    map.createLayer("floor", tileset);
    const objects = map.createLayer("objects", tileset)!;
    objects.setCollisionByProperty({ collides: true });
    this.grid = createGrid(
      map.width,
      map.height,
      map.tileWidth,
      (col, row) => objects.getTileAt(col, row, true)?.collides ?? false,
    );
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.keys = this.input.keyboard!.createCursorKeys();
    this.toast = createToast();
    this.voicePanel = createVoicePanel();
    this.voicePanel.onToggleMic(async (on) => {
      await this.voice?.setMicEnabled(on);
    });
    this.voicePanel.onToggleCamera(async (on) => {
      await this.voice?.setCameraEnabled(on);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      void this.stopVoice();
      void this.connection?.leave();
      this.toast.destroy();
      this.voicePanel.destroy();
    });
    void this.enter();
  }

  private async enter() {
    // The form's text input must receive arrow keys, so pause game input while it is open.
    this.input.keyboard!.enabled = false;
    this.profile = await promptProfile();
    this.input.keyboard!.enabled = true;

    this.me = new PlayerSprite(this, SPAWN.x, SPAWN.y, this.profile.name, this.profile.avatar);
    this.cameras.main.startFollow(this.me, true, 0.15, 0.15);
    void this.connect();
  }

  // Movement works offline; the connection only adds other players and sync.
  private async connect() {
    if (this.connecting || !this.profile) return;
    this.connecting = true;
    try {
      const connection = await connectToVoid(SERVER_URL, this.profile);
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
        if (sprite) this.tweens.add({ targets: sprite, x: p.x, y: p.y, duration: REMOTE_TWEEN_MS });
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
      voice.onLocalVideo((el) => this.voicePanel.setLocalVideo(el));
      voice.onDisconnect(() => {
        this.voice = undefined;
        this.voicePanel.setEnabled(false);
        this.toast.show("Voice disconnected", "error", 3000);
      });
      this.voice = voice;
      this.nearby = new Set();
      this.voicePanel.setEnabled(true);
    } catch (err) {
      console.warn("voice unavailable", err);
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
    this.nearby = nearbyIds(me, others, PROXIMITY_RADIUS, this.nearby);
    this.voice?.setNearby(this.nearby);
  }

  private removeOther(id: string) {
    this.others.get(id)?.destroy();
    this.others.delete(id);
  }

  update(time: number, delta: number) {
    const me = this.me;
    if (!me) return;

    const dir = {
      dx: (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0),
      dy: (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0),
    };
    if (dir.dx || dir.dy) {
      const target = stepPosition(me, dir, PLAYER_SPEED, delta);
      const next = moveWithCollision(this.grid, me, target, PLAYER_RADIUS);
      if (next.x !== me.x || next.y !== me.y) {
        me.setPosition(next.x, next.y);
        this.unsent = true;
      }
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
