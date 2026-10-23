// systems
import {
  PROXIMITY_MAX_TILES,
  PROXIMITY_MIN_TILES,
  PROXIMITY_STEP_TILES,
  type KeyScheme,
  type Settings,
} from "../systems/settings";

// net
import type { DeviceKind } from "../net/voice-connection";

import type { SettingsContext } from "./settings-window";

const DEVICE_FIELDS: {
  kind: DeviceKind;
  key: "micDeviceId" | "cameraDeviceId" | "speakerDeviceId";
  label: string;
}[] = [
  { kind: "audioinput", key: "micDeviceId", label: "Microphone" },
  { kind: "videoinput", key: "cameraDeviceId", label: "Camera" },
  { kind: "audiooutput", key: "speakerDeviceId", label: "Speaker" },
];

const KEY_OPTIONS: { value: KeyScheme; label: string }[] = [
  { value: "both", label: "Arrow keys and WASD" },
  { value: "arrows", label: "Arrow keys" },
  { value: "wasd", label: "WASD" },
];

const tilesLabel = (tiles: number) => `${tiles} ${tiles === 1 ? "tile" : "tiles"}`;

/** Device, volume, range and key settings. Every change applies at once and is saved by the caller. */
export function buildSystemTab(ctx: SettingsContext): HTMLElement {
  let current: Settings = ctx.settings;
  const change = (patch: Partial<Settings>) => {
    current = { ...current, ...patch };
    ctx.onSettingsChange(current);
  };

  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gap = "20px";
  root.innerHTML = `
    <section>
      <h2>Proximity</h2>
      <label>Hearing and seeing range
        <span class="row">
          <input type="range" name="range" min="${PROXIMITY_MIN_TILES}" max="${PROXIMITY_MAX_TILES}" step="${PROXIMITY_STEP_TILES}" />
          <output data-range></output>
        </span>
      </label>
      <p>Players inside this range can be heard and seen. A smaller range means fewer people at once.</p>
    </section>
    <section>
      <h2>Audio and video</h2>
      <div data-devices style="display: grid; gap: 12px"></div>
      <label>Volume
        <span class="row">
          <input type="range" name="volume" min="0" max="100" step="5" />
          <output data-volume></output>
        </span>
      </label>
      <p data-device-note hidden>Device names appear after you allow the microphone or camera once.</p>
    </section>
    <section>
      <h2>Controls</h2>
      <label>Movement keys
        <select name="keys"></select>
      </label>
    </section>
    <section>
      <button type="button" data-reset>Reset to defaults</button>
    </section>`;

  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const range = q<HTMLInputElement>("input[name=range]");
  const rangeOut = q("[data-range]");
  const volume = q<HTMLInputElement>("input[name=volume]");
  const volumeOut = q("[data-volume]");
  const keys = q<HTMLSelectElement>("select[name=keys]");

  for (const { value, label } of KEY_OPTIONS) keys.append(new Option(label, value));

  const showValues = () => {
    range.value = String(current.proximityTiles);
    rangeOut.textContent = tilesLabel(current.proximityTiles);
    volume.value = String(Math.round(current.volume * 100));
    volumeOut.textContent = `${volume.value}%`;
    keys.value = current.keys;
  };

  range.addEventListener("input", () => {
    change({ proximityTiles: Number(range.value) });
    rangeOut.textContent = tilesLabel(current.proximityTiles);
  });
  volume.addEventListener("input", () => {
    change({ volume: Number(volume.value) / 100 });
    volumeOut.textContent = `${volume.value}%`;
  });
  keys.addEventListener("change", () => change({ keys: keys.value as KeyScheme }));

  const selects = DEVICE_FIELDS.map(({ kind, key, label }) => {
    const wrap = document.createElement("label");
    wrap.append(label);
    const select = document.createElement("select");
    select.disabled = true;
    select.append(new Option("System default", ""));
    select.addEventListener("change", () => change({ [key]: select.value }));
    wrap.append(select);
    q("[data-devices]").append(wrap);

    void ctx.listDevices(kind).then((devices) => {
      // A device that has been unplugged falls back to the default entry.
      for (const [i, device] of devices.entries()) {
        if (device.id === "default") continue;
        select.append(new Option(device.label || `${label} ${i + 1}`, device.id));
        if (!device.label) q("[data-device-note]").removeAttribute("hidden");
      }
      select.value = [...select.options].some((o) => o.value === current[key]) ? current[key] : "";
      select.disabled = false;
    });
    return { select, key };
  });

  q("[data-reset]").addEventListener("click", () => {
    // Keep chosen devices: resetting the range should not unplug your headset.
    change({
      proximityTiles: ctx.defaults.proximityTiles,
      volume: ctx.defaults.volume,
      keys: ctx.defaults.keys,
    });
    showValues();
    for (const { select, key } of selects) select.value = current[key];
  });

  showValues();
  return root;
}
