import type { ConfigEntry, ConfigEntryType } from "@/plugins/api/interfaces";

export type ConfigEntryUIOnlyType = "dsp_settings_link";
export type ConfigEntryUIType = ConfigEntryType | ConfigEntryUIOnlyType;

export type InjectedConfigEntry = Omit<ConfigEntry, "type"> & {
  injected: true;
  type: ConfigEntryUIOnlyType;
  i18nParams?: Record<string, string | number>;
};

export type DspLinkConfigEntryUI = InjectedConfigEntry & {
  type: "dsp_settings_link";
  note_key?: string;
};

// server entries stay unchanged
export type ServerConfigEntryUI = ConfigEntry & {
  injected?: false;
};

export type ConfigEntryUI = ServerConfigEntryUI | InjectedConfigEntry;

export const isInjected = (e: ConfigEntryUI): e is InjectedConfigEntry =>
  "injected" in e && e.injected === true;

export const isDspLinkEntry = (e: ConfigEntryUI): e is DspLinkConfigEntry =>
  isInjected(e) && e.type === "dsp_settings_link";

const DEFAULT_DSP_LINK_ENTRY: Omit<
  DspLinkConfigEntryUI,
  "value" | "default_value"
> & {
  value: boolean;
  default_value: boolean;
} = {
  injected: true,
  type: "dsp_settings_link",
  key: "dsp_settings_link",
  category: "audio",
  label: "",
  required: false,
};

export function makeDspLinkEntry(
  overrides: Partial<DspLinkConfigEntryUI> = {},
): DspLinkConfigEntryUI {
  return {
    ...DEFAULT_DSP_LINK_ENTRY,
    ...overrides,
    injected: true,
    type: "dsp_settings_link",
  };
}
