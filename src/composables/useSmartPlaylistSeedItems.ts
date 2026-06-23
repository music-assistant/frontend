import { computed, ref } from "vue";
import api from "@/plugins/api";
import { buildItemUri } from "@/helpers/utils";
import type {
  Album,
  Artist,
  ItemMapping,
  Playlist,
  Track,
} from "@/plugins/api/interfaces";
import {
  MediaType,
  ProviderFeature as ProviderFeatureEnum,
} from "@/plugins/api/interfaces";
import { setupDebouncedSearch } from "./useSmartPlaylistSearchHelpers";

export type SeedKind = "track" | "artist" | "album" | "playlist";

export const SEED_MAX = 10;

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

  const trackSearch = ref("");
  const trackResults = ref<Track[]>([]);
  const isTrackSearching = ref(false);

  const artistSearch = ref("");
  const artistResults = ref<Artist[]>([]);
  const isArtistSearching = ref(false);

  const albumSearch = ref("");
  const albumResults = ref<Album[]>([]);
  const isAlbumSearching = ref(false);

  const playlistSearch = ref("");
  const playlistResults = ref<Playlist[]>([]);
  const isPlaylistSearching = ref(false);

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

  setupDebouncedSearch({
    query: trackSearch,
    results: trackResults,
    isSearching: isTrackSearching,
    searchFn: async (q) => {
      if (!hasSimilarTracksProvider.value) return [];
      const result = await api.search(q, [MediaType.TRACK], 20);
      return result.tracks;
    },
  });

  setupDebouncedSearch({
    query: artistSearch,
    results: artistResults,
    isSearching: isArtistSearching,
    searchFn: async (q) => {
      if (!hasSimilarTracksProvider.value) return [];
      const result = await api.search(q, [MediaType.ARTIST], 20);
      return result.artists;
    },
  });

  setupDebouncedSearch({
    query: albumSearch,
    results: albumResults,
    isSearching: isAlbumSearching,
    searchFn: async (q) => {
      if (!hasSimilarTracksProvider.value) return [];
      const result = await api.search(q, [MediaType.ALBUM], 20);
      return result.albums;
    },
  });

  setupDebouncedSearch({
    query: playlistSearch,
    results: playlistResults,
    isSearching: isPlaylistSearching,
    searchFn: async (q) => {
      if (!hasSimilarTracksProvider.value) return [];
      const result = await api.search(q, [MediaType.PLAYLIST], 20);
      return result.playlists;
    },
  });

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
      if (kind === "track") {
        trackSearch.value = "";
        trackResults.value = [];
      } else if (kind === "artist") {
        artistSearch.value = "";
        artistResults.value = [];
      } else if (kind === "album") {
        albumSearch.value = "";
        albumResults.value = [];
      } else {
        playlistSearch.value = "";
        playlistResults.value = [];
      }
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

    trackSearch,
    trackResults,
    isTrackSearching,
    artistSearch,
    artistResults,
    isArtistSearching,
    albumSearch,
    albumResults,
    isAlbumSearching,
    playlistSearch,
    playlistResults,
    isPlaylistSearching,

    addSeed,
    addSeedFromSearch,
    removeSeed,
    clearSeeds,
    loadSeedsFromUris,
  };
}
