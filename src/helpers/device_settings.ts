// Per-device frontend settings (see DEVICE_SETTING_KEYS) live in localStorage
// instead of the server side user preferences.

export const MOBILE_SIDEBAR_SIDE_KEY = "frontend.settings.mobile_sidebar_side";

/**
 * Store a per-device setting under its `frontend.settings.` key.
 *
 * Pass null to clear it.
 */
export function saveDeviceSetting(key: string, value: string | null) {
  const storageKey = `frontend.settings.${key}`;
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
export function subscribeToDeviceSetting(
  storageKey: string,
  onChange: () => void,
) {
  window.addEventListener("storage", (event) => {
    // a null key means the whole storage was cleared
    if (event.key !== null && event.key !== storageKey) return;
    onChange();
  });
}
