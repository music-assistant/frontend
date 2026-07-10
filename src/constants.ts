export const DEFAULT_MENU_ITEMS = [
  "discover",
  "search",
  "browse",
  "party",
  "music_quiz",
  "artists",
  "albums",
  "tracks",
  "playlists",
  "authors_narrators",
  "audiobooks",
  "podcasts",
  "radios",
  "genres",
  "settings",
];

export const PLUGIN_MENU_ITEMS = ["party", "music_quiz"];
export const MENU_ITEMS_SEEN_PREFERENCE_KEY = "menu_items_seen";

export const SYNCGROUP_PREFIX = "syncgroup_";

// Frontend setting keys that are persisted per-device in localStorage.
// Every other setting is stored server-side as a per-user preference.
export const DEVICE_SETTING_KEYS = new Set([
  "web_player_enabled",
  "enable_browser_controls",
  "force_mobile_layout",
  "mobile_sidebar_side",
]);
