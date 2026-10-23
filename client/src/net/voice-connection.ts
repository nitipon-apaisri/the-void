// lib
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
} from "livekit-client";

// shared
import type { VoiceToken } from "@void/shared";

// config
import { MAX_SCREEN_SHARES } from "../config/env";

// systems
import { pickScreenSharers } from "../systems/screen-share";

export type MediaKind = "audio" | "video" | "screen";
export type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

export interface MediaDevice {
  id: string;
  label: string;
}

/**
 * Devices of one kind. Labels stay empty until the browser has granted mic or camera access
 * once, so callers should supply their own fallback text.
 */
export async function listMediaDevices(kind: DeviceKind): Promise<MediaDevice[]> {
  try {
    const devices = await Room.getLocalDevices(kind, false);
    return devices.map((d) => ({ id: d.deviceId, label: d.label }));
  } catch {
    return [];
  }
}

/** What scenes and UI know about voice. Keeps LiveKit out of game code. */
export interface VoiceConnection {
  /** Only these players are subscribed to, nearest first; everyone else costs no bandwidth. */
  setNearby(nearestFirst: readonly string[]): void;
  setMicEnabled(on: boolean): Promise<void>;
  setCameraEnabled(on: boolean): Promise<void>;
  /** Empty `deviceId` means the system default. Takes effect now if the device is in use. */
  setDevice(kind: DeviceKind, deviceId: string): Promise<void>;
  /** Rejects if the person cancels the picker or the OS denies capture. */
  setScreenShareEnabled(on: boolean): Promise<void>;
  /** An audio, camera or screen element for a nearby player became available. */
  onMedia(cb: (playerId: string, el: HTMLMediaElement, kind: MediaKind) => void): void;
  onMediaRemoved(cb: (playerId: string, el: HTMLMediaElement) => void): void;
  /** A player left hearing range or the call; drop whatever UI is left for them. */
  onPlayerGone(cb: (playerId: string) => void): void;
  /** Our own camera preview. */
  onLocalVideo(cb: (el: HTMLVideoElement | undefined) => void): void;
  /** Our share started or stopped, including when the browser's own "stop sharing" ends it. */
  onLocalScreen(cb: (sharing: boolean) => void): void;
  onDisconnect(cb: () => void): void;
  leave(): Promise<void>;
}

export async function connectVoice({ url, token }: VoiceToken): Promise<VoiceConnection> {
  // autoSubscribe off: proximity decides who we receive.
  const room = new Room({ adaptiveStream: true, dynacast: true });
  let nearestFirst: readonly string[] = [];
  let leaving = false;
  let onMedia: Parameters<VoiceConnection["onMedia"]>[0] = () => {};
  let onMediaRemoved: Parameters<VoiceConnection["onMediaRemoved"]>[0] = () => {};
  let onPlayerGone: Parameters<VoiceConnection["onPlayerGone"]>[0] = () => {};
  let onLocalVideo: Parameters<VoiceConnection["onLocalVideo"]>[0] = () => {};
  let onLocalScreen: Parameters<VoiceConnection["onLocalScreen"]>[0] = () => {};

  const isScreen = (source: Track.Source) =>
    source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio;

  const applySubscriptions = () => {
    const near = new Set(nearestFirst);
    const sharing = new Set<string>();
    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.source === Track.Source.ScreenShare) sharing.add(participant.identity);
      }
    }
    const screens = pickScreenSharers(nearestFirst, sharing, MAX_SCREEN_SHARES);

    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        // Screens are capped separately because they cost far more bandwidth than a camera.
        const want = isScreen(pub.source)
          ? screens.has(participant.identity)
          : near.has(participant.identity);
        // isDesired, not isSubscribed: the latter stays false while a request is pending.
        if (pub.isDesired !== want) pub.setSubscribed(want);
      }
    }
  };

  room
    .on(RoomEvent.ParticipantConnected, applySubscriptions)
    .on(RoomEvent.ParticipantDisconnected, (p) => onPlayerGone(p.identity))
    .on(RoomEvent.TrackPublished, applySubscriptions)
    .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
      // Shared-screen audio is not published by us, so there is nothing to play for it.
      if (track.source === Track.Source.ScreenShareAudio) return;
      const kind: MediaKind =
        track.source === Track.Source.ScreenShare
          ? "screen"
          : track.kind === Track.Kind.Audio
            ? "audio"
            : "video";
      if (track.kind !== Track.Kind.Audio && track.kind !== Track.Kind.Video) return;
      onMedia(participant.identity, track.attach(), kind);
    })
    .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
      for (const el of track.detach()) onMediaRemoved(participant.identity, el);
    })
    .on(RoomEvent.LocalTrackPublished, (pub) => {
      if (pub.source === Track.Source.ScreenShare) onLocalScreen(true);
      // Our own screen is not previewed: it would show the app inside itself.
      else if (pub.track?.kind === Track.Kind.Video)
        onLocalVideo(pub.track.attach() as HTMLVideoElement);
    })
    .on(RoomEvent.LocalTrackUnpublished, (pub) => {
      if (pub.source === Track.Source.ScreenShare) onLocalScreen(false);
      if (pub.source !== Track.Source.Camera) return;
      pub.track?.detach();
      onLocalVideo(undefined);
    });

  await room.connect(url, token);

  return {
    setNearby(ids) {
      const next = new Set(ids);
      for (const id of nearestFirst) if (!next.has(id)) onPlayerGone(id);
      nearestFirst = ids;
      applySubscriptions();
    },
    setMicEnabled: async (on) => void (await room.localParticipant.setMicrophoneEnabled(on)),
    setCameraEnabled: async (on) => void (await room.localParticipant.setCameraEnabled(on)),
    // No audio: system audio capture differs by OS and is out of scope for now.
    setScreenShareEnabled: async (on) =>
      void (await room.localParticipant.setScreenShareEnabled(on, { audio: false })),
    async setDevice(kind, deviceId) {
      try {
        await room.switchActiveDevice(kind, deviceId || "default");
      } catch (err) {
        // Output selection is unsupported in some browsers, and a device can be unplugged.
        console.warn(`could not switch ${kind}`, err);
      }
    },
    onMedia: (cb) => (onMedia = cb),
    onMediaRemoved: (cb) => (onMediaRemoved = cb),
    onPlayerGone: (cb) => (onPlayerGone = cb),
    onLocalVideo: (cb) => (onLocalVideo = cb),
    onLocalScreen: (cb) => (onLocalScreen = cb),
    onDisconnect: (cb) =>
      room.on(RoomEvent.Disconnected, () => {
        if (!leaving) cb();
      }),
    async leave() {
      leaving = true;
      if (room.state !== ConnectionState.Disconnected) await room.disconnect();
    },
  };
}
