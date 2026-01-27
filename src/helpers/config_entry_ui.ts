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
  i18nParams?: Record<string, string | number>;
  note_key?: string;
};

export type ServerConfigEntryUI = ConfigEntry & {
  injected?: false;
  note_key?: string;
};
export type ConfigEntryUI = ServerConfigEntryUI | InjectedConfigEntry;

export const isInjected = (e: ConfigEntryUI): e is InjectedConfigEntry =>
  (e as InjectedConfigEntry).injected === true;

export const isDspLinkEntry = (
  e: ConfigEntryUI,
): e is InjectedConfigEntry & {
  type: typeof UI_ENTRY_TYPE.DSP_SETTINGS_LINK;
} => isInjected(e) && e.type === UI_ENTRY_TYPE.DSP_SETTINGS_LINK;
