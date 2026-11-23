import { computed, ref } from "vue";
import api from "@/plugins/api";
import { buildItemUri } from "@/helpers/utils";
import type {
  Album,
  Artist,
  ItemMapping,
  Playlist,
  SearchResults,
  Track,
} from "@/plugins/api/interfaces";
import {
  MediaType,
  ProviderFeature as ProviderFeatureEnum,
} from "@/plugins/api/interfaces";
import { setupSubmitSearch } from "./useSmartPlaylistSearchHelpers";

export type SeedKind = "track" | "artist" | "album" | "playlist";

export const SEED_MAX = 10;

const SEARCH_LIMIT = 20;

export interface SeedItem {
  uri: string;
  kind: SeedKind;
  name: string;
  subtitle?: string;
}

type SearchableItem = Track | Artist | Album | Playlist;

function primaryArtistName(
  artists: Array<ItemMapping | Artist> | undefined,
): string {
  return (artists as Artist[] | undefined)?.[0]?.name ?? "";
}

function buildSeedItem(
  item: SearchableItem,
  kind: SeedKind,
  similarTracksProviderIds: string[],
): SeedItem {
  // Prefer a SIMILAR_TRACKS-capable provider mapping so the seed URI resolves
  // through the same provider that will produce the similar-tracks output.
  // For library items (no matching mapping), buildItemUri falls back to library://.
  const mapping =
    item.provider_mappings?.find((m) =>
      similarTracksProviderIds.includes(m.provider_instance),
    ) ?? null;
  const mediaType =
    kind === "track"
      ? MediaType.TRACK
      : kind === "artist"
        ? MediaType.ARTIST
        : kind === "album"
          ? MediaType.ALBUM
          : MediaType.PLAYLIST;
  const uri = buildItemUri(mediaType, mapping, item.item_id);
  let subtitle: string | undefined;
  if (kind === "track")
    subtitle = primaryArtistName((item as Track).artists) || undefined;
  else if (kind === "album")
    subtitle = primaryArtistName((item as Album).artists) || undefined;
  return { uri, kind, name: item.name, subtitle };
}

export function useSmartPlaylistSeedItems() {
  const activeKind = ref<SeedKind>("track");
  const seeds = ref<SeedItem[]>([]);

  // All seed kinds now flow through the unified radio-mode path
  // (seed track/expanded-tracks → similar tracks), so a single SIMILAR_TRACKS
  // provider check covers every kind.
  const similarTracksProviderIds = computed(() =>
    Object.values(api.providers)
      .filter((p) =>
        p.supported_features.includes(ProviderFeatureEnum.SIMILAR_TRACKS),
      )
      .map((p) => p.instance_id),
  );
  const hasSimilarTracksProvider = computed(
    () => similarTracksProviderIds.value.length > 0,
  );

  function setupSeedSearch(
    mediaType: MediaType,
    itemsOf: (found: SearchResults) => SearchableItem[],
  ) {
    const query = ref("");
    const results = ref<SearchableItem[]>([]);
    const isSearching = ref(false);
    const { submit, isSubmitted } = setupSubmitSearch({
      query,
      results,
      isSearching,
      searchFn: async (q) => {
        if (!hasSimilarTracksProvider.value) return [];
        return itemsOf(await api.search(q, [mediaType], SEARCH_LIMIT));
      },
    });
    return { query, results, isSearching, submit, isSubmitted };
  }

  const searches: Record<SeedKind, ReturnType<typeof setupSeedSearch>> = {
    track: setupSeedSearch(MediaType.TRACK, (found) => found.tracks),
    artist: setupSeedSearch(MediaType.ARTIST, (found) => found.artists),
    album: setupSeedSearch(MediaType.ALBUM, (found) => found.albums),
    playlist: setupSeedSearch(MediaType.PLAYLIST, (found) => found.playlists),
  };

  const activeSearch = computed(() => searches[activeKind.value]);

  const searchQuery = computed({
    get: () => activeSearch.value.query.value,
    set: (query) => {
      activeSearch.value.query.value = query;
    },
  });
  const searchResults = computed(() => activeSearch.value.results.value);
  const isSearching = computed(() => activeSearch.value.isSearching.value);
  const isSearchSubmitted = computed(
    () => activeSearch.value.isSubmitted.value,
  );

  function submitSearch() {
    return activeSearch.value.submit();
  }

  const isFull = computed(() => seeds.value.length >= SEED_MAX);
  const hasSeed = computed(() => seeds.value.length > 0);

  function addSeed(item: SeedItem): boolean {
    if (isFull.value) return false;
    if (seeds.value.some((s) => s.uri === item.uri)) return false;
    seeds.value = [...seeds.value, item];
    return true;
  }

  function addSeedFromSearch(item: SearchableItem, kind: SeedKind): boolean {
    const seed = buildSeedItem(item, kind, similarTracksProviderIds.value);
    const added = addSeed(seed);
    if (added) {
      searches[kind].query.value = "";
      searches[kind].results.value = [];
    }
    return added;
  }

  function removeSeed(uri: string) {
    seeds.value = seeds.value.filter((s) => s.uri !== uri);
  }

  function clearSeeds() {
    seeds.value = [];
  }

  function loadSeedsFromUris(
    uris: { uri: string; kind: SeedKind }[],
    names: Record<string, string> | undefined,
  ) {
    seeds.value = uris.map(({ uri, kind }) => ({
      uri,
      kind,
      name: names?.[uri] ?? uri,
    }));
  }

  return {
    activeKind,
    seeds,
    hasSeed,
    isFull,
    hasSimilarTracksProvider,

    trackSearch: searches.track.query,
    trackResults: searches.track.results,
    searchQuery,
    searchResults,
    isSearching,
    isSearchSubmitted,

    submitSearch,
    addSeed,
    addSeedFromSearch,
    removeSeed,
    clearSeeds,
    loadSeedsFromUris,
  };
}
