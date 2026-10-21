// utils
import { injectStyle } from "../utils/dom";

export interface VoicePanel {
  setEnabled(enabled: boolean): void;
  addMedia(playerId: string, el: HTMLMediaElement, kind: "audio" | "video"): void;
  removeMedia(playerId: string, el: HTMLMediaElement): void;
  removePlayer(playerId: string): void;
  setLocalVideo(el: HTMLVideoElement | undefined): void;
  onToggleMic(cb: (on: boolean) => Promise<void>): void;
  onToggleCamera(cb: (on: boolean) => Promise<void>): void;
  destroy(): void;
}

const STYLE_ID = "void-voice-style";
const STYLES = `
.void-voice { position: fixed; left: 50%; bottom: 16px; z-index: 900; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px; font: 14px system-ui, sans-serif; }
.void-voice__videos { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 90vw; }
.void-voice__videos video { width: 160px; height: 120px; object-fit: cover; border-radius: 8px;
  background: #111827; border: 1px solid #374151; }
.void-voice__controls { display: flex; gap: 8px; }
.void-voice button { padding: 8px 14px; border-radius: 8px; border: 1px solid #374151;
  background: #1f2937; color: #f9fafb; cursor: pointer; font: inherit; }
.void-voice button[aria-pressed="true"] { background: #064e3b; border-color: #047857; }
.void-voice button:disabled { opacity: 0.5; cursor: not-allowed; }
.void-voice button:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
`;

export function createVoicePanel(): VoicePanel {
  injectStyle(STYLE_ID, STYLES);

  const root = document.createElement("div");
  root.className = "void-voice";
  const videos = document.createElement("div");
  videos.className = "void-voice__videos";
  // Hidden from layout; audio elements only need to be in the document to play reliably.
  const audio = document.createElement("div");
  audio.hidden = true;
  const controls = document.createElement("div");
  controls.className = "void-voice__controls";
  root.append(videos, audio, controls);

  let toggleMic: (on: boolean) => Promise<void> = async () => {};
  let toggleCamera: (on: boolean) => Promise<void> = async () => {};

  const makeToggle = (label: string, run: (on: boolean) => Promise<void>) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = true;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", async () => {
      const next = button.getAttribute("aria-pressed") !== "true";
      button.disabled = true;
      try {
        await run(next);
        button.setAttribute("aria-pressed", String(next));
      } catch (err) {
        // Permission denied or no device: stay off and say why in the console.
        console.error(`${label} failed`, err);
      } finally {
        button.disabled = false;
      }
    });
    return button;
  };

  const mic = makeToggle("Mic", (on) => toggleMic(on));
  const camera = makeToggle("Camera", (on) => toggleCamera(on));
  controls.append(mic, camera);
  document.body.append(root);

  let localVideo: HTMLVideoElement | undefined;
  // One element per player and kind, so a repeated track event cannot stack tiles.
  const media = new Map<string, HTMLMediaElement>();
  const key = (playerId: string, kind: string) => `${playerId}:${kind}`;

  return {
    setEnabled(enabled) {
      mic.disabled = !enabled;
      camera.disabled = !enabled;
      if (!enabled) {
        mic.setAttribute("aria-pressed", "false");
        camera.setAttribute("aria-pressed", "false");
        videos.replaceChildren();
        audio.replaceChildren();
        media.clear();
      }
    },
    addMedia(playerId, el, kind) {
      media.get(key(playerId, kind))?.remove();
      media.set(key(playerId, kind), el);
      if (kind === "video") {
        el.setAttribute("aria-label", "Nearby player video");
        videos.append(el);
      } else {
        audio.append(el);
      }
    },
    removeMedia(playerId, el) {
      el.remove();
      for (const kind of ["audio", "video"]) {
        if (media.get(key(playerId, kind)) === el) media.delete(key(playerId, kind));
      }
    },
    removePlayer(playerId) {
      for (const kind of ["audio", "video"]) {
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
    onToggleMic: (cb) => (toggleMic = cb),
    onToggleCamera: (cb) => (toggleCamera = cb),
    destroy: () => root.remove(),
  };
}
