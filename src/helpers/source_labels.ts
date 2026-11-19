import { isAudioSourcePlugin } from "@/helpers/provider_config";
import {
  type ProviderManifest,
  ProviderOffering,
} from "@/plugins/api/interfaces";

/** What a source can offer, as its labels name it, in the order they show. */
export const SOURCE_LABELS = [
  "library",
  "radio",
  "podcasts",
  "audiobooks",
  "live",
] as const;

export type SourceLabel = (typeof SOURCE_LABELS)[number];

/** The translation key of each label. */
export const SOURCE_LABEL_KEYS: Readonly<Record<SourceLabel, string>> = {
  library: "settings.source_labels.library",
  radio: "settings.source_labels.radio",
  podcasts: "settings.source_labels.podcasts",
  audiobooks: "settings.source_labels.audiobooks",
  live: "settings.source_labels.live",
};

// a source earns a label with any one of the media types its manifest
// provides; a live source is an audio source plugin instead
const LABEL_OFFERINGS: Readonly<
  Record<Exclude<SourceLabel, "live">, readonly ProviderOffering[]>
> = {
  library: [
    ProviderOffering.ARTIST,
    ProviderOffering.ALBUM,
    ProviderOffering.TRACK,
    ProviderOffering.PLAYLIST,
  ],
  radio: [ProviderOffering.RADIO],
  podcasts: [ProviderOffering.PODCAST],
  audiobooks: [ProviderOffering.AUDIOBOOK],
};

/**
 * What a source offers, as its manifest says, in the order the labels show: the
 * media types it provides. Live sources are the plugins through which audio
 * plays into Music Assistant.
 *
 * @param manifest - The manifest of the provider.
 */
export function getSourceLabels(manifest?: ProviderManifest): SourceLabel[] {
  const provides = manifest?.provides ?? [];
  return SOURCE_LABELS.filter((label) => {
    if (label === "live") return isAudioSourcePlugin(manifest);
    return LABEL_OFFERINGS[label].some((offering) =>
      provides.includes(offering),
    );
  });
}
