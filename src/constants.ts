export const SYNCGROUP_PREFIX = "syncgroup_";

// Small primary-colored badge, positioned over an icon to signal an active
// filter. Wrap the icon in a `relative inline-flex` span and add this dot.
export const ACTIVE_DOT_CLASS =
  "bg-primary absolute -top-0.5 -right-0.5 size-1.5 rounded-full";

// Frontend setting keys that are persisted per-device in localStorage.
// Every other setting is stored server-side as a per-user preference.
export const DEVICE_SETTING_KEYS = new Set([
  "web_player_enabled",
  "enable_browser_controls",
  "force_mobile_layout",
  "mobile_sidebar_side",
  "ha_kiosk_mode",
]);
