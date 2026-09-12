import {
  createRowRegistry,
  type RowDefinition,
} from "@/components/details/rowRegistry";
import { api } from "@/plugins/api";
import { ProviderFeature, type Track } from "@/plugins/api/interfaces";

export type TrackRowId =
  | "lyrics"
  | "appears_on"
  | "other_versions"
  | "similar_tracks"
  | "provider_mappings";

// default order; no row has a source picker, the server picks the
// similar-tracks provider itself
export const TRACK_ROWS: readonly RowDefinition<TrackRowId>[] = [
  { id: "lyrics", labelKey: "lyrics" },
  { id: "appears_on", labelKey: "appears_on" },
  { id: "other_versions", labelKey: "other_versions" },
  { id: "similar_tracks", labelKey: "similar_tracks" },
  { id: "provider_mappings", labelKey: "mapped_providers" },
];

export const TRACK_ROWS_PREFERENCE_KEY = "track.rows";

/**
 * Row ids the track page can show, in default order: similar tracks only
 * while a loaded provider can supply them.
 */
export function availableTrackRowIds(): TrackRowId[] {
  const similarSupported = Object.values(api.providers).some((provider) =>
    provider.supported_features.includes(ProviderFeature.SIMILAR_TRACKS),
  );
  return TRACK_ROWS.filter(
    (row) => row.id !== "similar_tracks" || similarSupported,
  ).map((row) => row.id);
}

/** The track page's rows and the user's customization of them. */
export const trackRows = createRowRegistry<TrackRowId, Track>({
  rows: TRACK_ROWS,
  preferenceKey: TRACK_ROWS_PREFERENCE_KEY,
});
