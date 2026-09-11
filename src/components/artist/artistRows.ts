import { setUserPreference } from "@/composables/userPreferences";
import {
  readRowsConfig,
  resolveRowsConfig,
  withRowHidden,
  withRowsOrder,
  writeRowsConfig,
} from "@/helpers/rowsConfig";
import { api } from "@/plugins/api";
import {
  ProviderFeature,
  ProviderType,
  type Artist,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

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

// "library" = in-library items, "all" = library + every mapped provider, else a provider instance id
export type ArtistRowSource = "library" | "all" | (string & {});

export interface ArtistRowDefinition {
  id: ArtistRowId;
  labelKey: string;
  // "music" = singers, "audiobook" = authors/narrators, "both" = either
  audience: "music" | "audiobook" | "both";
  adminOnly?: boolean;
  // gets a "Source" picker in Edit rows
  supportsSource?: boolean;
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
  isAdmin: boolean,
): ArtistRowId[] {
  const audience = isAudiobookArtist ? "audiobook" : "music";
  return ARTIST_ROWS.filter(
    (row) =>
      (row.audience === "both" || row.audience === audience) &&
      (isAdmin || !row.adminOnly),
  ).map((row) => row.id);
}

export function artistRowDefinition(id: ArtistRowId): ArtistRowDefinition {
  return ARTIST_ROWS_BY_ID[id];
}

/**
 * The user's row order and hidden rows, resolved against the rows available
 * for this artist. Nothing is hidden by default.
 */
export function resolveArtistRows(availableIds: ArtistRowId[]): {
  order: ArtistRowId[];
  hidden: Set<ArtistRowId>;
} {
  const { order, hidden } = resolveRowsConfig(
    readRowsConfig(ARTIST_ROWS_PREFERENCE_KEY),
    availableIds,
  );
  return {
    order: order as ArtistRowId[],
    hidden: hidden as Set<ArtistRowId>,
  };
}

/** Hide or unhide a single row on every artist page. */
export async function setArtistRowHidden(
  id: ArtistRowId,
  hidden: boolean,
): Promise<void> {
  await writeRowsConfig(
    ARTIST_ROWS_PREFERENCE_KEY,
    withRowHidden(readRowsConfig(ARTIST_ROWS_PREFERENCE_KEY), id, hidden),
  );
}

/**
 * Reorder the rows available for this artist. The given ids are rearranged
 * within the positions they already occupy in the full saved order, so rows
 * that don't apply to this artist keep their slots.
 */
export async function setArtistRowsOrder(
  orderedIds: ArtistRowId[],
  availableIds: ArtistRowId[],
): Promise<void> {
  const cfg = withRowsOrder(
    readRowsConfig(ARTIST_ROWS_PREFERENCE_KEY),
    orderedIds,
    availableIds,
  );
  if (!cfg) return;
  await writeRowsConfig(ARTIST_ROWS_PREFERENCE_KEY, cfg);
}

/** Clears both preferences (order/visibility and sources). */
export async function resetArtistRows(): Promise<void> {
  await writeRowsConfig(ARTIST_ROWS_PREFERENCE_KEY, {});
  await setUserPreference(ARTIST_ROW_SOURCES_PREFERENCE_KEY, {});
}

/** The user's saved source for a row, if any. */
export function getArtistRowSource(
  id: ArtistRowId,
): ArtistRowSource | undefined {
  const source = savedRowSources()[id];
  return typeof source === "string" ? source : undefined;
}

export async function setArtistRowSource(
  id: ArtistRowId,
  source: ArtistRowSource | undefined,
): Promise<void> {
  const sources = { ...savedRowSources() };
  if (source) {
    sources[id] = source;
  } else {
    delete sources[id];
  }
  await setUserPreference(ARTIST_ROW_SOURCES_PREFERENCE_KEY, sources);
}

/**
 * The sources a row of this artist can be fed from, in the order a picker lists them: the
 * library (release rows only), every provider at once (release rows only when the server can
 * merge the discography, and never while the user's own provider filter is active), then
 * each provider able to supply the row. Empty for a row without a source picker and for a
 * provider artist, which stays on its own provider.
 */
export function artistRowSources(
  id: ArtistRowId,
  artist: Artist,
  supportsDiscography: boolean,
): ArtistRowSource[] {
  if (!ARTIST_ROWS_BY_ID[id].supportsSource) return [];
  return rowSourceCandidates(id, artist, supportsDiscography);
}

/**
 * The source that actually feeds a row for this artist: the saved one while it is still among
 * the row's sources, otherwise the default. Provider (non-library) artists always resolve to
 * their own provider. The default is every provider at once where that is offered, else the
 * library for the release rows (albums, singles, and the artist's own releases that
 * appearances are checked against) and the first capable provider for the aggregated rows.
 */
export function effectiveArtistRowSource(
  id: ArtistRowId,
  artist: Artist,
  supportsDiscography: boolean,
): ArtistRowSource {
  if (artist.provider !== "library") return artist.provider;
  const sources = rowSourceCandidates(id, artist, supportsDiscography);
  const saved = getArtistRowSource(id);
  if (saved && sources.includes(saved)) return saved;
  if (sources.includes("all")) return "all";
  return sources.includes("library") ? "library" : (sources[0] ?? "library");
}

const ARTIST_ROWS_BY_ID = Object.fromEntries(
  ARTIST_ROWS.map((row) => [row.id, row]),
) as Record<ArtistRowId, ArtistRowDefinition>;

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

/** The saved `{ [rowId]: source }` object, empty when unset or invalid. */
function savedRowSources(): Partial<Record<ArtistRowId, ArtistRowSource>> {
  const pref =
    store.currentUser?.preferences?.[ARTIST_ROW_SOURCES_PREFERENCE_KEY];
  if (!pref || typeof pref !== "object") return {};
  return pref as Partial<Record<ArtistRowId, ArtistRowSource>>;
}

/** The sources a row of a library artist could be fed from, whether or not it has a picker. */
function rowSourceCandidates(
  id: ArtistRowId,
  artist: Artist,
  supportsDiscography: boolean,
): ArtistRowSource[] {
  if (artist.provider !== "library") return [];
  const sources: ArtistRowSource[] = [];
  if (RELEASE_ROWS.includes(id)) sources.push("library");
  // merging every provider server-side would bypass the filter the user set for themselves
  if (
    (!RELEASE_ROWS.includes(id) || supportsDiscography) &&
    !hasUserProviderFilter()
  ) {
    sources.push("all");
  }
  return [...sources, ...rowSourceProviders(id, artist)];
}

/**
 * The providers able to supply a row, sorted by name: those the artist is mapped to that
 * support the row's feature and, for the rows the server aggregates, any metadata or plugin
 * provider that does. Providers hidden by the user's provider filter are left out.
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
  return [...ids]
    .filter(providerVisible)
    .sort((a, b) =>
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

function hasUserProviderFilter(): boolean {
  return (store.currentUser?.provider_filter ?? []).length > 0;
}

/** Whether the user's provider filter, when set, includes the provider. */
function providerVisible(instanceId: string): boolean {
  return (
    !hasUserProviderFilter() ||
    store.currentUser!.provider_filter.includes(instanceId)
  );
}
