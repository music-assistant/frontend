// Per-device frontend settings (see DEVICE_SETTING_KEYS) live in localStorage
// instead of the server side user preferences. Every function here takes the
// bare setting key and owns the storage key it maps to.

const STORAGE_KEY_PREFIX = "frontend.settings.";

export const MOBILE_SIDEBAR_SIDE = "mobile_sidebar_side";
export const HA_KIOSK_MODE = "ha_kiosk_mode";
export const FORCE_MOBILE_LAYOUT = "force_mobile_layout";
export const BROWSER_MEDIA_CONTROLS = "enable_browser_controls";

export enum BrowserMediaControlsMode {
  ACTIVE_PLAYER = "active_player",
  WEB_PLAYER = "web_player",
  DISABLED = "disabled",
}

/**
 * Read a per-device setting, or null when it is unset.
 *
 * Also null when site data is blocked, as it is in a cross-origin iframe.
 */
export function readDeviceSetting(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + key);
  } catch {
    return null;
  }
}

/**
 * Return which players may be exposed to browser media controls.
 */
export function getBrowserMediaControlsMode(): BrowserMediaControlsMode {
  const storedValue = readDeviceSetting(BROWSER_MEDIA_CONTROLS);
  switch (storedValue) {
    case BrowserMediaControlsMode.ACTIVE_PLAYER:
      return BrowserMediaControlsMode.ACTIVE_PLAYER;
    case BrowserMediaControlsMode.DISABLED:
    case "false":
      return BrowserMediaControlsMode.DISABLED;
    case BrowserMediaControlsMode.WEB_PLAYER:
    case "true":
    default:
      return BrowserMediaControlsMode.WEB_PLAYER;
  }
}

/**
 * Store a per-device setting. Pass null to clear it.
 */
export function saveDeviceSetting(key: string, value: string | null) {
  const storageKey = STORAGE_KEY_PREFIX + key;
  if (value === null) {
    localStorage.removeItem(storageKey);
  } else {
    localStorage.setItem(storageKey, value);
  }
  // localStorage only notifies other tabs by itself, so announce the change to
  // this one as well to save consumers a reload
  window.dispatchEvent(
    new StorageEvent("storage", { key: storageKey, newValue: value }),
  );
}

/**
 * Run the callback whenever a per-device setting changes, in this tab or another.
 */
export function subscribeToDeviceSetting(key: string, onChange: () => void) {
  const storageKey = STORAGE_KEY_PREFIX + key;
  window.addEventListener("storage", (event) => {
    // a null key means the whole storage was cleared
    if (event.key !== null && event.key !== storageKey) return;
    onChange();
  });
}
