import type { ConfigEntry, ConfigEntryType } from "@/plugins/api/interfaces";

export const CONFIG_KEY_UI = {
  DSP_SETTINGS_LINK: "dsp_settings_link",
} as const;

export type UiOnlyKey = (typeof CONFIG_KEY_UI)[keyof typeof CONFIG_KEY_UI];
export type ConfigKeyUI = string | UiOnlyKey;

export const UI_ENTRY_TYPE = {
  // entry type equals key for dsp_settings_link
  DSP_SETTINGS_LINK: CONFIG_KEY_UI.DSP_SETTINGS_LINK,
} as const;

export type UiOnlyEntryType =
  (typeof UI_ENTRY_TYPE)[keyof typeof UI_ENTRY_TYPE];
export type ConfigEntryUIType = ConfigEntryType | UiOnlyEntryType;

export type InjectedConfigEntry = Omit<ConfigEntry, "type"> & {
  injected: true;
  type: ConfigEntryUIType;
  read_only?: boolean;
};

export type ServerConfigEntryUI = ConfigEntry & {
  injected?: false;
};
export type ConfigEntryUI = ServerConfigEntryUI | InjectedConfigEntry;

export const isInjected = (e: ConfigEntryUI): e is InjectedConfigEntry =>
  (e as InjectedConfigEntry).injected === true;

export const isDspLinkEntry = (
  e: ConfigEntryUI,
): e is InjectedConfigEntry & {
  type: typeof UI_ENTRY_TYPE.DSP_SETTINGS_LINK;
} => isInjected(e) && e.type === UI_ENTRY_TYPE.DSP_SETTINGS_LINK;

/**
 * Merges a freshly fetched set of config entries into the entries currently
 * on screen after a PROVIDERS_UPDATED refresh.
 *
 * `incoming` wins for everything about an entry's definition (options,
 * read_only, whether it exists at all), since that's what the server just
 * told us is current. `current` wins for `value`, so a refresh never
 * discards something the user typed but hasn't saved yet.
 *
 * Every returned entry is a fresh object, so the form is free to keep editing
 * them in place without reaching back into either argument.
 */
export const mergeConfigEntries = (
  current: Record<string, ConfigEntry>,
  incoming: Record<string, ConfigEntry>,
): Record<string, ConfigEntry> => {
  const merged: Record<string, ConfigEntry> = {};
  for (const [key, incomingEntry] of Object.entries(incoming)) {
    const currentEntry = current[key];
    merged[key] = currentEntry
      ? { ...incomingEntry, value: currentEntry.value }
      : { ...incomingEntry };
  }
  return merged;
};
