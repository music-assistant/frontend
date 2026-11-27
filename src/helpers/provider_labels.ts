import {
  getPluginLabels,
  OTHER_PLUGIN_LABEL,
  PLUGIN_LABEL_KEYS,
  PLUGIN_LABELS,
  type PluginLabel,
} from "@/helpers/plugin_labels";
import { providerListType } from "@/helpers/settings_pages";
import {
  getSourceLabels,
  SOURCE_LABEL_KEYS,
  SOURCE_LABELS,
  type SourceLabel,
} from "@/helpers/source_labels";
import { type ProviderManifest, ProviderType } from "@/plugins/api/interfaces";

/** What a provider offers as a label: a music source's or a plugin's. */
export type ProviderLabel = SourceLabel | PluginLabel;

/** The translation key of each label. */
export const PROVIDER_LABEL_KEYS: Readonly<Record<ProviderLabel, string>> = {
  ...SOURCE_LABEL_KEYS,
  ...PLUGIN_LABEL_KEYS,
};

// each list only holds the labels of its own kind, so one order serves them all
const PROVIDER_LABELS: readonly ProviderLabel[] = [
  ...SOURCE_LABELS,
  ...PLUGIN_LABELS,
];

// fewer labels leave nothing to filter between
const MIN_FILTER_LABELS = 2;

/**
 * Whether a value, such as one read from a route, is a label.
 *
 * @param value - The value to check.
 */
export const isProviderLabel = (value: unknown): value is ProviderLabel =>
  (PROVIDER_LABELS as readonly unknown[]).includes(value);

/**
 * What a provider offers as its manifest says, as the labels of the list it
 * shows in: those of a music source, those of a plugin, and none for any other
 * provider.
 *
 * @param manifest - The manifest of the provider.
 */
export function getProviderLabels(
  manifest?: ProviderManifest,
): ProviderLabel[] {
  if (!manifest) return [];
  switch (providerListType(manifest.type, manifest.provides)) {
    case ProviderType.MUSIC:
      return getSourceLabels(manifest);
    case ProviderType.PLUGIN:
      return getPluginLabels(manifest);
    default:
      return [];
  }
}

/**
 * The labels that say what a provider offers: all of them but other, which
 * only gathers the plugins without a label for the filter, so it tells nothing
 * about one.
 *
 * @param labels - The labels of the provider.
 */
export const getShownLabels = (
  labels: readonly ProviderLabel[],
): ProviderLabel[] => labels.filter((label) => label !== OTHER_PLUGIN_LABEL);

/**
 * The labels a list of providers can be filtered on: those at least one of
 * them has, in the order the labels show. None while fewer than two occur.
 *
 * @param labelsOfProviders - The labels of each provider in the list.
 */
export function getFilterLabels(
  labelsOfProviders: readonly (readonly ProviderLabel[])[],
): ProviderLabel[] {
  const labels = PROVIDER_LABELS.filter((label) =>
    labelsOfProviders.some((labelsOfProvider) =>
      labelsOfProvider.includes(label),
    ),
  );
  return labels.length >= MIN_FILTER_LABELS ? labels : [];
}
