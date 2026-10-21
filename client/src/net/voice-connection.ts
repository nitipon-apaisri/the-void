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

/** What scenes and UI know about voice. Keeps LiveKit out of game code. */
export interface VoiceConnection {
  /** Only players in this set are subscribed to; everyone else costs no bandwidth. */
  setNearby(ids: ReadonlySet<string>): void;
  setMicEnabled(on: boolean): Promise<void>;
  setCameraEnabled(on: boolean): Promise<void>;
  /** An audio or video element for a nearby player became available. */
  onMedia(cb: (playerId: string, el: HTMLMediaElement, kind: "audio" | "video") => void): void;
  onMediaRemoved(cb: (playerId: string, el: HTMLMediaElement) => void): void;
  /** Our own camera preview. */
  onLocalVideo(cb: (el: HTMLVideoElement | undefined) => void): void;
  onDisconnect(cb: () => void): void;
  leave(): Promise<void>;
}

export async function connectVoice({ url, token }: VoiceToken): Promise<VoiceConnection> {
  // autoSubscribe off: proximity decides who we receive.
  const room = new Room({ adaptiveStream: true, dynacast: true });
  let nearby: ReadonlySet<string> = new Set();
  let leaving = false;
  let onMedia: Parameters<VoiceConnection["onMedia"]>[0] = () => {};
  let onMediaRemoved: Parameters<VoiceConnection["onMediaRemoved"]>[0] = () => {};
  let onLocalVideo: Parameters<VoiceConnection["onLocalVideo"]>[0] = () => {};

  const applySubscriptions = () => {
    for (const participant of room.remoteParticipants.values()) {
      const want = nearby.has(participant.identity);
      for (const pub of participant.trackPublications.values()) {
        if (pub.isSubscribed !== want) pub.setSubscribed(want);
      }
    }
  };

  room
    .on(RoomEvent.ParticipantConnected, applySubscriptions)
    .on(RoomEvent.TrackPublished, applySubscriptions)
    .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Audio && track.kind !== Track.Kind.Video) return;
      onMedia(
        participant.identity,
        track.attach(),
        track.kind === Track.Kind.Audio ? "audio" : "video",
      );
    })
    .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
      for (const el of track.detach()) onMediaRemoved(participant.identity, el);
    })
    .on(RoomEvent.LocalTrackPublished, (pub) => {
      if (pub.track?.kind === Track.Kind.Video)
        onLocalVideo(pub.track.attach() as HTMLVideoElement);
    })
    .on(RoomEvent.LocalTrackUnpublished, (pub) => {
      if (pub.track?.kind !== Track.Kind.Video) return;
      pub.track.detach();
      onLocalVideo(undefined);
    });

  await room.connect(url, token);

  return {
    setNearby(ids) {
      nearby = ids;
      applySubscriptions();
    },
    setMicEnabled: async (on) => void (await room.localParticipant.setMicrophoneEnabled(on)),
    setCameraEnabled: async (on) => void (await room.localParticipant.setCameraEnabled(on)),
    onMedia: (cb) => (onMedia = cb),
    onMediaRemoved: (cb) => (onMediaRemoved = cb),
    onLocalVideo: (cb) => (onLocalVideo = cb),
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
