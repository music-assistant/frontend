import {
  type ProviderManifest,
  ProviderOffering,
} from "@/plugins/api/interfaces";

/** What a plugin delivers, as its labels name it, in the order they show. */
export const PLUGIN_LABELS = [
  "ai",
  "tts",
  "scrobble",
  "assistant",
  "visualizer",
  "recommendations",
  "fun",
  "other",
] as const;

export type PluginLabel = (typeof PLUGIN_LABELS)[number];

/** The label of the plugins whose manifest names none of the others. */
export const OTHER_PLUGIN_LABEL = "other" satisfies PluginLabel;

/** The translation key of each label. */
export const PLUGIN_LABEL_KEYS: Readonly<Record<PluginLabel, string>> = {
  ai: "settings.plugin_labels.ai",
  tts: "settings.plugin_labels.tts",
  scrobble: "settings.plugin_labels.scrobble",
  assistant: "settings.plugin_labels.assistant",
  visualizer: "settings.plugin_labels.visualizer",
  recommendations: "settings.plugin_labels.recommendations",
  fun: "settings.plugin_labels.fun",
  other: "settings.plugin_labels.other",
};

// what a plugin's manifest provides to earn each label
const LABEL_OFFERINGS: Readonly<
  Record<Exclude<PluginLabel, typeof OTHER_PLUGIN_LABEL>, ProviderOffering>
> = {
  ai: ProviderOffering.AI,
  tts: ProviderOffering.TTS,
  scrobble: ProviderOffering.SCROBBLE,
  assistant: ProviderOffering.ASSISTANT,
  visualizer: ProviderOffering.VISUALIZER,
  recommendations: ProviderOffering.RECOMMENDATIONS,
  fun: ProviderOffering.FUN,
};

/**
 * What a plugin delivers, in the order the labels show: the features its
 * manifest provides, or only the other label when it names none of them.
 *
 * @param manifest - The manifest of the plugin.
 */
export function getPluginLabels(manifest: ProviderManifest): PluginLabel[] {
  const labels = PLUGIN_LABELS.filter(
    (label) =>
      label !== OTHER_PLUGIN_LABEL &&
      (manifest.provides ?? []).includes(LABEL_OFFERINGS[label]),
  );
  return labels.length ? labels : [OTHER_PLUGIN_LABEL];
}
