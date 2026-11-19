import { isAudioSourcePlugin } from "@/helpers/provider_config";
import {
  ProviderFeature,
  type ProviderInstance,
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

// what earns a running source a label on top of what its manifest provides,
// such as audiobooks its account turns on
const LABEL_FEATURES: Readonly<
  Record<Exclude<SourceLabel, "live">, readonly ProviderFeature[]>
> = {
  library: [
    ProviderFeature.LIBRARY_ARTISTS,
    ProviderFeature.LIBRARY_ALBUMS,
    ProviderFeature.LIBRARY_TRACKS,
    ProviderFeature.LIBRARY_PLAYLISTS,
  ],
  radio: [ProviderFeature.LIBRARY_RADIOS],
  podcasts: [ProviderFeature.LIBRARY_PODCASTS],
  audiobooks: [ProviderFeature.LIBRARY_AUDIOBOOKS],
};

/**
 * What a source offers, in the order the labels show: the media types its
 * manifest provides, and while it runs also the library features it reports.
 * Live sources are the plugins through which audio plays into Music Assistant,
 * which only the manifest says.
 *
 * @param manifest - The manifest of the provider.
 * @param instance - The running instance of the source; none while it is not running.
 */
export function getSourceLabels(
  manifest?: ProviderManifest,
  instance?: ProviderInstance,
): SourceLabel[] {
  const provides = manifest?.provides ?? [];
  const features = instance?.supported_features ?? [];
  return SOURCE_LABELS.filter((label) => {
    if (label === "live") return isAudioSourcePlugin(manifest);
    return (
      LABEL_OFFERINGS[label].some((offering) => provides.includes(offering)) ||
      LABEL_FEATURES[label].some((feature) => features.includes(feature))
    );
  });
}
