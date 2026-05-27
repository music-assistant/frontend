import { computed, ref } from "vue";
import api from "@/plugins/api";
import { buildItemUri } from "@/helpers/utils";
import type { Artist, Track } from "@/plugins/api/interfaces";
import {
  MediaType,
  ProviderFeature as ProviderFeatureEnum,
} from "@/plugins/api/interfaces";
import { setupDebouncedSearch } from "./useSmartPlaylistSearchHelpers";

export function useSmartPlaylistSeedItems() {
  const seedTrackUri = ref("");
  const selectedSeedTrack = ref<Track | null>(null);
  const seedTrackSearch = ref("");
  const seedTrackResults = ref<Track[]>([]);

  const seedArtistUri = ref("");
  const selectedSeedArtist = ref<Artist | null>(null);
  const seedArtistSearch = ref("");
  const seedArtistResults = ref<Artist[]>([]);
  const isSeedArtistSearching = ref(false);
  const isSeedSearching = ref(false);

  const _similarTrackProviderIds = computed(() =>
    Object.values(api.providers)
      .filter((p) =>
        p.supported_features.includes(ProviderFeatureEnum.SIMILAR_TRACKS),
      )
      .map((p) => p.instance_id),
  );

  const _similarArtistProviderIds = computed(() =>
    Object.values(api.providers)
      .filter((p) =>
        p.supported_features.includes(ProviderFeatureEnum.SIMILAR_ARTISTS),
      )
      .map((p) => p.instance_id),
  );

  // Don't filter results by provider_mappings: the server's similar_*
  // dispatchers fall back to plugin-tier providers, which never appear there.
  setupDebouncedSearch({
    query: seedTrackSearch,
    results: seedTrackResults,
    isSearching: isSeedSearching,
    searchFn: async (q) => {
      if (_similarTrackProviderIds.value.length === 0) return [];
      const result = await api.search(q, [MediaType.TRACK], 20);
      return result.tracks;
    },
  });

  setupDebouncedSearch({
    query: seedArtistSearch,
    results: seedArtistResults,
    isSearching: isSeedArtistSearching,
    searchFn: async (q) => {
      if (_similarArtistProviderIds.value.length === 0) return [];
      const result = await api.search(q, [MediaType.ARTIST], 20);
      return result.artists;
    },
  });

  function selectSeedTrack(track: Track) {
    selectedSeedTrack.value = track;
    const mapping = track.provider_mappings?.find((m) =>
      _similarTrackProviderIds.value.includes(m.provider_instance),
    );
    seedTrackUri.value = buildItemUri(
      MediaType.TRACK,
      mapping ?? null,
      track.item_id,
    );
    seedTrackSearch.value = "";
    seedTrackResults.value = [];
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
      _similarArtistProviderIds.value.includes(m.provider_instance),
    );
    seedArtistUri.value = buildItemUri(
      MediaType.ARTIST,
      mapping ?? null,
      artist.item_id,
    );
    seedArtistSearch.value = "";
    seedArtistResults.value = [];
    selectedSeedTrack.value = null;
    seedTrackUri.value = "";
  }

  function clearSeedArtist() {
    selectedSeedArtist.value = null;
    seedArtistUri.value = "";
    seedArtistSearch.value = "";
    seedArtistResults.value = [];
  }

  return {
    seedTrackUri,
    selectedSeedTrack,
    seedTrackSearch,
    seedTrackResults,
    isSeedSearching,
    seedArtistUri,
    selectedSeedArtist,
    seedArtistSearch,
    seedArtistResults,
    isSeedArtistSearching,
    _similarTrackProviderIds,
    _similarArtistProviderIds,
    selectSeedTrack,
    clearSeedTrack,
    selectSeedArtist,
    clearSeedArtist,
  };
}
