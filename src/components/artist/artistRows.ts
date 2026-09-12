import {
  createRowRegistry,
  type RowDefinition,
  type RowSource,
} from "@/components/details/rowRegistry";
import { api } from "@/plugins/api";
import {
  ProviderFeature,
  ProviderType,
  type Artist,
} from "@/plugins/api/interfaces";

export type ArtistRowId =
  | "bio"
  | "top_tracks"
  | "albums"
  | "singles_eps"
  | "appears_on"
  | "similar_artists"
  | "audiobooks"
  | "audiobooks_all" // authors / narrators only
  | "provider_mappings"
  | "artwork"; // admins only

export interface ArtistRowDefinition extends RowDefinition<ArtistRowId> {
  // "music" = singers, "audiobook" = authors/narrators, "both" = either
  audience: "music" | "audiobook" | "both";
}

// Default order, shared by both audiences: filtering out the rows of the other
// audience leaves that audience's default order.
export const ARTIST_ROWS: readonly ArtistRowDefinition[] = [
  { id: "bio", labelKey: "biography", audience: "both" },
  {
    id: "top_tracks",
    labelKey: "artist_toptracks",
    audience: "music",
    supportsSource: true,
  },
  {
    id: "albums",
    labelKey: "albums",
    audience: "music",
    supportsSource: true,
  },
  {
    id: "singles_eps",
    labelKey: "singles_eps",
    audience: "music",
    supportsSource: true,
  },
  { id: "appears_on", labelKey: "appears_on", audience: "music" },
  {
    id: "similar_artists",
    labelKey: "similar_artists",
    audience: "music",
    supportsSource: true,
  },
  { id: "audiobooks", labelKey: "audiobooks", audience: "audiobook" },
  {
    id: "audiobooks_all",
    labelKey: "artist_all_audiobooks",
    audience: "audiobook",
  },
  { id: "provider_mappings", labelKey: "mapped_providers", audience: "both" },
  { id: "artwork", labelKey: "images", audience: "both", adminOnly: true },
];

export const ARTIST_ROWS_PREFERENCE_KEY = "artist.rows";
export const ARTIST_ROW_SOURCES_PREFERENCE_KEY = "artist.rowSources";

/** Row ids applicable to the given artist type / user, in default order. */
export function availableArtistRowIds(
  isAudiobookArtist: boolean,
  managesLibrary: boolean,
): ArtistRowId[] {
  const audience = isAudiobookArtist ? "audiobook" : "music";
  return ARTIST_ROWS.filter(
    (row) =>
      (row.audience === "both" || row.audience === audience) &&
      (managesLibrary || !row.adminOnly),
  ).map((row) => row.id);
}

/**
 * The artist page's rows and the user's customization of them.
 *
 * A row's sources are the library for a release row and every provider at once
 * for a row the server aggregates, then each provider able to supply the row;
 * the first of them is the default. A provider (non-library) artist offers no
 * choice and always stays on its own provider.
 */
export const artistRows = createRowRegistry<ArtistRowId, Artist>({
  rows: ARTIST_ROWS,
  preferenceKey: ARTIST_ROWS_PREFERENCE_KEY,
  sourcesPreferenceKey: ARTIST_ROW_SOURCES_PREFERENCE_KEY,
  sourceCandidates: rowSourceCandidates,
  defaultSource: (_id, artist, candidates) =>
    artist.provider === "library" ? candidates[0] : artist.provider,
});

// rows fed by the artist's releases, in or outside the library
const RELEASE_ROWS: ArtistRowId[] = ["albums", "singles_eps", "appears_on"];

// rows the server aggregates over every provider by default
const ALL_PROVIDER_ROWS: ArtistRowId[] = ["top_tracks", "similar_artists"];

// the provider capability each row with a source picker depends on
const ROW_FEATURES: Partial<Record<ArtistRowId, ProviderFeature>> = {
  top_tracks: ProviderFeature.ARTIST_TOPTRACKS,
  albums: ProviderFeature.ARTIST_ALBUMS,
  singles_eps: ProviderFeature.ARTIST_ALBUMS,
  similar_artists: ProviderFeature.SIMILAR_ARTISTS,
};

/** The sources a row of a library artist could be fed from, whether or not it has a picker. */
function rowSourceCandidates(id: ArtistRowId, artist: Artist): RowSource[] {
  if (artist.provider !== "library") return [];
  const first: RowSource = RELEASE_ROWS.includes(id) ? "library" : "all";
  return [first, ...rowSourceProviders(id, artist)];
}

/**
 * The providers able to supply a row, sorted by name: those the artist is mapped to that
 * support the row's feature and, for the rows the server aggregates, any metadata or plugin
 * provider that does. The server only loads the sources the user may use.
 */
function rowSourceProviders(id: ArtistRowId, artist: Artist): string[] {
  const feature = ROW_FEATURES[id];
  if (!feature) return [];
  const ids = new Set<string>();
  for (const mapping of artist.provider_mappings) {
    if (providerSupports(mapping.provider_instance, feature)) {
      ids.add(mapping.provider_instance);
    }
  }
  if (ALL_PROVIDER_ROWS.includes(id)) {
    for (const provider of Object.values(api.providers)) {
      const isMetadataOrPlugin =
        provider.type === ProviderType.METADATA ||
        provider.type === ProviderType.PLUGIN;
      if (
        isMetadataOrPlugin &&
        providerSupports(provider.instance_id, feature)
      ) {
        ids.add(provider.instance_id);
      }
    }
  }
  return [...ids].sort((a, b) =>
    (api.providers[a]?.name ?? a).localeCompare(api.providers[b]?.name ?? b),
  );
}

function providerSupports(
  instanceId: string,
  feature: ProviderFeature,
): boolean {
  return (
    api.providers[instanceId]?.supported_features.includes(feature) ?? false
  );
}
