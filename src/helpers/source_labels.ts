import { isAudioSourcePlugin } from "@/helpers/provider_config";
import {
  MediaType,
  ProviderFeature,
  type ProviderInstance,
  type ProviderManifest,
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

// fewer labels leave nothing to filter between
const MIN_FILTER_LABELS = 2;

// a source earns a label with any one of its media types; a live source is an
// audio source plugin instead
const LABEL_MEDIA_TYPES: Readonly<
  Record<Exclude<SourceLabel, "live">, readonly MediaType[]>
> = {
  library: [
    MediaType.ARTIST,
    MediaType.ALBUM,
    MediaType.TRACK,
    MediaType.PLAYLIST,
  ],
  radio: [MediaType.RADIO],
  podcasts: [MediaType.PODCAST],
  audiobooks: [MediaType.AUDIOBOOK],
};

// what earns a running source a label on top of its manifest's media types,
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
 * manifest names, and while it runs also the library features it reports.
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
  const mediaTypes = manifest?.media_types ?? [];
  const features = instance?.supported_features ?? [];
  return SOURCE_LABELS.filter((label) => {
    if (label === "live") return isAudioSourcePlugin(manifest);
    return (
      LABEL_MEDIA_TYPES[label].some((type) => mediaTypes.includes(type)) ||
      LABEL_FEATURES[label].some((feature) => features.includes(feature))
    );
  });
}

/**
 * The labels a list of sources can be filtered on: those at least one of them
 * has, in the order the labels show. None while fewer than two occur.
 *
 * @param labelsOfSources - The labels of each source in the list.
 */
export function getFilterLabels(
  labelsOfSources: readonly (readonly SourceLabel[])[],
): SourceLabel[] {
  const labels = SOURCE_LABELS.filter((label) =>
    labelsOfSources.some((labelsOfSource) => labelsOfSource.includes(label)),
  );
  return labels.length >= MIN_FILTER_LABELS ? labels : [];
}
