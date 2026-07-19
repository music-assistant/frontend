export const SYNCGROUP_PREFIX = "syncgroup_";

// Frontend setting keys that are persisted per-device in localStorage.
// Every other setting is stored server-side as a per-user preference.
export const DEVICE_SETTING_KEYS = new Set([
  "web_player_enabled",
  "enable_browser_controls",
  "force_mobile_layout",
  "mobile_sidebar_side",
]);
