import { ConfigEntryType, type ConfigEntry } from "@/plugins/api/interfaces";

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

/**
 * Entry types whose ConfigEntryField branch takes no `disabled` binding.
 *
 * An unmet `depends_on` normally leaves an entry visible but disabled. These types
 * have nothing to disable, so a form must hide them instead or they read as if the
 * dependency were met.
 */
export const NON_INTERACTIVE_ENTRY_TYPES: ConfigEntryUIType[] = [
  ConfigEntryType.DIVIDER,
  ConfigEntryType.LABEL,
  ConfigEntryType.ALERT,
  ConfigEntryType.IMAGE,
];

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

/**
 * Merges the entries a config action returned into the ones currently on screen.
 *
 * An action response carries entry definitions without the stored values, so every
 * entry it does not explicitly set keeps the value the form already holds. Without
 * that, pressing any action button would drop the whole form back to its defaults.
 */
export const mergeActionEntries = (
  current: Record<string, ConfigEntry>,
  incoming: ConfigEntry[],
): Record<string, ConfigEntry> => {
  const merged: Record<string, ConfigEntry> = {};
  for (const entry of incoming) {
    merged[entry.key] = {
      ...entry,
      value: entry.value ?? current[entry.key]?.value,
    };
  }
  return merged;
};
