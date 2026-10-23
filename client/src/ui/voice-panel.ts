// net
import type { MediaKind } from "../net/voice-connection";

// ui
import { ICONS } from "./icons";
import { applyTheme } from "./theme";

// utils
import { injectStyle } from "../utils/dom";

export interface VoicePanel {
  setEnabled(enabled: boolean): void;
  addMedia(playerId: string, el: HTMLMediaElement, kind: MediaKind): void;
  removeMedia(playerId: string, el: HTMLMediaElement): void;
  removePlayer(playerId: string): void;
  setLocalVideo(el: HTMLVideoElement | undefined): void;
  /** 0 to 1; applies to everyone heard now and to anyone who arrives later. */
  setVolume(volume: number): void;
  onToggleMic(cb: (on: boolean) => Promise<void>): void;
  onToggleCamera(cb: (on: boolean) => Promise<void>): void;
  onToggleScreen(cb: (on: boolean) => Promise<void>): void;
  /** Syncs the button when sharing starts or stops outside it (e.g. the browser's stop button). */
  setScreenSharing(on: boolean): void;
  destroy(): void;
}

const STYLE_ID = "void-voice-style";
const STYLES = `
.void-voice { position: fixed; left: 50%; bottom: 18px; z-index: 900; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 12px; font: 500 12px var(--v-font); }
.void-voice__videos, .void-voice__screens { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; max-width: 90vw; }
.void-voice__videos video { width: 168px; height: 126px; object-fit: cover; border-radius: var(--v-radius);
  background: var(--v-glass-solid); border: 1px solid var(--v-line); box-shadow: var(--v-shadow); }
.void-voice__screens video { width: min(520px, 90vw); aspect-ratio: 16 / 9; object-fit: contain;
  border-radius: var(--v-radius); background: #000; border: 1px solid var(--v-line); box-shadow: var(--v-shadow); }
.void-voice__controls { display: flex; gap: 4px; padding: 6px; border-radius: 22px; }
.void-voice button { display: grid; justify-items: center; gap: 3px; min-width: 68px; padding: 9px 10px 7px;
  border-radius: 16px; border: 0; background: transparent; color: var(--v-muted); cursor: pointer; font: inherit;
  transition: background 0.15s, color 0.15s; }
.void-voice button:hover:not(:disabled) { background: var(--v-hover); color: var(--v-text); }
.void-voice button[aria-pressed="true"] { background: rgb(139 147 255 / 0.2); color: var(--v-text); }
.void-voice button[aria-pressed="true"] svg { color: var(--v-accent); }
.void-voice button:disabled { opacity: 0.4; cursor: not-allowed; }
.void-voice button:focus-visible { outline: 2px solid var(--v-accent); outline-offset: 1px; }
`;

export function createVoicePanel(): VoicePanel {
  applyTheme();
  injectStyle(STYLE_ID, STYLES);

  const root = document.createElement("div");
  root.className = "void-voice";
  const screens = document.createElement("div");
  screens.className = "void-voice__screens";
  const videos = document.createElement("div");
  videos.className = "void-voice__videos";
  // Hidden from layout; audio elements only need to be in the document to play reliably.
  const audio = document.createElement("div");
  audio.hidden = true;
  const controls = document.createElement("div");
  controls.className = "void-voice__controls v-glass";
  root.append(screens, videos, audio, controls);

  let toggleMic: (on: boolean) => Promise<void> = async () => {};
  let toggleCamera: (on: boolean) => Promise<void> = async () => {};
  let toggleScreen: (on: boolean) => Promise<void> = async () => {};

  const makeToggle = (label: string, icon: string, run: (on: boolean) => Promise<void>) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `${icon}<span>${label}</span>`;
    button.disabled = true;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", async () => {
      const next = button.getAttribute("aria-pressed") !== "true";
      button.disabled = true;
      try {
        await run(next);
        button.setAttribute("aria-pressed", String(next));
      } catch (err) {
        // Cancelling a picker is a choice, not a failure. Anything else: say why in the console.
        if (!(
          err instanceof DOMException &&
          err.name === "NotAllowedError" &&
          label === "Share screen"
        )) {
          console.error(`${label} failed`, err);
        }
      } finally {
        button.disabled = false;
      }
    });
    return button;
  };

  const mic = makeToggle("Mic", ICONS.mic, (on) => toggleMic(on));
  const camera = makeToggle("Camera", ICONS.camera, (on) => toggleCamera(on));
  const screen = makeToggle("Share screen", ICONS.screen, (on) => toggleScreen(on));
  controls.append(mic, camera, screen);
  document.body.append(root);

  let localVideo: HTMLVideoElement | undefined;
  let volume = 1;
  // One element per player and kind, so a repeated track event cannot stack tiles.
  const media = new Map<string, HTMLMediaElement>();
  const key = (playerId: string, kind: string) => `${playerId}:${kind}`;

  return {
    setEnabled(enabled) {
      mic.disabled = !enabled;
      camera.disabled = !enabled;
      screen.disabled = !enabled;
      if (!enabled) {
        mic.setAttribute("aria-pressed", "false");
        camera.setAttribute("aria-pressed", "false");
        screen.setAttribute("aria-pressed", "false");
        screens.replaceChildren();
        videos.replaceChildren();
        audio.replaceChildren();
        media.clear();
      }
    },
    addMedia(playerId, el, kind) {
      media.get(key(playerId, kind))?.remove();
      media.set(key(playerId, kind), el);
      if (kind === "screen") {
        el.setAttribute("aria-label", "Nearby player's shared screen");
        screens.append(el);
      } else if (kind === "video") {
        el.setAttribute("aria-label", "Nearby player video");
        videos.append(el);
      } else {
        el.volume = volume;
        audio.append(el);
      }
    },
    removeMedia(playerId, el) {
      el.remove();
      for (const kind of ["audio", "video", "screen"]) {
        if (media.get(key(playerId, kind)) === el) media.delete(key(playerId, kind));
      }
    },
    removePlayer(playerId) {
      for (const kind of ["audio", "video", "screen"]) {
        media.get(key(playerId, kind))?.remove();
        media.delete(key(playerId, kind));
      }
    },
    setLocalVideo(el) {
      localVideo?.remove();
      localVideo = el;
      if (!el) return;
      el.muted = true;
      el.setAttribute("aria-label", "Your camera");
      videos.prepend(el);
    },
    setVolume(next) {
      volume = next;
      for (const el of audio.querySelectorAll("audio")) el.volume = next;
    },
    onToggleMic: (cb) => (toggleMic = cb),
    onToggleCamera: (cb) => (toggleCamera = cb),
    onToggleScreen: (cb) => (toggleScreen = cb),
    setScreenSharing: (on) => screen.setAttribute("aria-pressed", String(on)),
    destroy: () => root.remove(),
  };
}
