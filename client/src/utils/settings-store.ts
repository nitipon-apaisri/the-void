// systems
import { sanitizeSettings, type Settings } from "../systems/settings";

import { loadJson, saveJson } from "./storage";

const KEY = "void.settings";

// Per device on purpose: microphones and speakers differ between the laptop and the desktop.
export const loadSettings = (defaults: Settings): Settings =>
  sanitizeSettings(loadJson<unknown>(KEY), defaults);

export const saveSettings = (settings: Settings) => saveJson(KEY, settings);
