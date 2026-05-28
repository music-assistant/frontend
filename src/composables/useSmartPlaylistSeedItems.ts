import { computed, ref } from "vue";
import api from "@/plugins/api";
import { buildItemUri } from "@/helpers/utils";
import type { Artist, Track } from "@/plugins/api/interfaces";
import {
  MediaType,
  ProviderFeature as ProviderFeatureEnum,
} from "@/plugins/api/interfaces";
import { setupDebouncedSearch } from "./useSmartPlaylistSearchHelpers";

export type SeedKind = "track" | "artist";

export function useSmartPlaylistSeedItems() {
  const seedKind = ref<SeedKind>("track");

  const selectedSeedTrack = ref<Track | null>(null);
  const seedTrackUri = ref("");
  const seedTrackSearch = ref("");
  const seedTrackResults = ref<Track[]>([]);
  const isSeedTrackSearching = ref(false);

  const selectedSeedArtist = ref<Artist | null>(null);
  const seedArtistUri = ref("");
  const seedArtistSearch = ref("");
  const seedArtistResults = ref<Artist[]>([]);
  const isSeedArtistSearching = ref(false);

  const similarTrackProviderIds = computed(() =>
    Object.values(api.providers)
      .filter((p) =>
        p.supported_features.includes(ProviderFeatureEnum.SIMILAR_TRACKS),
      )
      .map((p) => p.instance_id),
  );

  const similarArtistProviderIds = computed(() =>
    Object.values(api.providers)
      .filter((p) =>
        p.supported_features.includes(ProviderFeatureEnum.SIMILAR_ARTISTS),
      )
      .map((p) => p.instance_id),
  );

  const hasTrackProvider = computed(
    () => similarTrackProviderIds.value.length > 0,
  );
  const hasArtistProvider = computed(
    () => similarArtistProviderIds.value.length > 0,
  );

  setupDebouncedSearch({
    query: seedTrackSearch,
    results: seedTrackResults,
    isSearching: isSeedTrackSearching,
    searchFn: async (q) => {
      if (!hasTrackProvider.value) return [];
      const result = await api.search(q, [MediaType.TRACK], 20);
      return result.tracks;
    },
  });

  setupDebouncedSearch({
    query: seedArtistSearch,
    results: seedArtistResults,
    isSearching: isSeedArtistSearching,
    searchFn: async (q) => {
      if (!hasArtistProvider.value) return [];
      const result = await api.search(q, [MediaType.ARTIST], 20);
      return result.artists;
    },
  });

  function selectSeedTrack(track: Track) {
    selectedSeedTrack.value = track;
    const mapping = track.provider_mappings?.find((m) =>
      similarTrackProviderIds.value.includes(m.provider_instance),
    );
    seedTrackUri.value = buildItemUri(
      MediaType.TRACK,
      mapping ?? null,
      track.item_id,
    );
    seedTrackSearch.value = "";
    seedTrackResults.value = [];
    clearSeedArtist();
  }

  function clearSeedTrack() {
    selectedSeedTrack.value = null;
    seedTrackUri.value = "";
    seedTrackSearch.value = "";
    seedTrackResults.value = [];
  }

  function selectSeedArtist(artist: Artist) {
    selectedSeedArtist.value = artist;
    const mapping = artist.provider_mappings?.find((m) =>
      similarArtistProviderIds.value.includes(m.provider_instance),
    );
    seedArtistUri.value = buildItemUri(
      MediaType.ARTIST,
      mapping ?? null,
      artist.item_id,
    );
    seedArtistSearch.value = "";
    seedArtistResults.value = [];
    clearSeedTrack();
  }

  function clearSeedArtist() {
    selectedSeedArtist.value = null;
    seedArtistUri.value = "";
    seedArtistSearch.value = "";
    seedArtistResults.value = [];
  }

  const hasSeed = computed(
    () => !!selectedSeedTrack.value || !!selectedSeedArtist.value,
  );

  return {
    seedKind,
    selectedSeedTrack,
    seedTrackUri,
    seedTrackSearch,
    seedTrackResults,
    isSeedTrackSearching,
    selectedSeedArtist,
    seedArtistUri,
    seedArtistSearch,
    seedArtistResults,
    isSeedArtistSearching,
    similarTrackProviderIds,
    similarArtistProviderIds,
    hasTrackProvider,
    hasArtistProvider,
    selectSeedTrack,
    clearSeedTrack,
    selectSeedArtist,
    clearSeedArtist,
    hasSeed,
  };
}
