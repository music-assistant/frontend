import { computed, ref, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import api from "@/plugins/api";
import { buildItemUri } from "@/helpers/utils";
import type { Artist, Track } from "@/plugins/api/interfaces";
import {
  MediaType,
  ProviderFeature as ProviderFeatureEnum,
} from "@/plugins/api/interfaces";

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

  const _doSeedSearch = useDebounceFn(async (q: string) => {
    const providerIds = _similarTrackProviderIds.value;
    if (q.length < 2 || providerIds.length === 0) {
      seedTrackResults.value = [];
      isSeedSearching.value = false;
      return;
    }
    try {
      const result = await api.search(q, [MediaType.TRACK], 20);
      if (seedTrackSearch.value !== q) return;
      seedTrackResults.value = result.tracks.filter((t) =>
        t.provider_mappings?.some((m) =>
          providerIds.includes(m.provider_instance),
        ),
      );
    } finally {
      if (seedTrackSearch.value === q) isSeedSearching.value = false;
    }
  }, 400);

  watch(seedTrackSearch, (q) => {
    if (q.length < 2) {
      seedTrackResults.value = [];
      isSeedSearching.value = false;
    } else {
      isSeedSearching.value = true;
      _doSeedSearch(q);
    }
  });

  const _doSeedArtistSearch = useDebounceFn(async (q: string) => {
    const providerIds = _similarArtistProviderIds.value;
    if (q.length < 2 || providerIds.length === 0) {
      seedArtistResults.value = [];
      isSeedArtistSearching.value = false;
      return;
    }
    try {
      const result = await api.search(q, [MediaType.ARTIST], 20);
      if (seedArtistSearch.value !== q) return;
      seedArtistResults.value = result.artists.filter((a) =>
        a.provider_mappings?.some((m) =>
          providerIds.includes(m.provider_instance),
        ),
      );
    } finally {
      if (seedArtistSearch.value === q) isSeedArtistSearching.value = false;
    }
  }, 400);

  watch(seedArtistSearch, (q) => {
    if (q.length < 2) {
      seedArtistResults.value = [];
      isSeedArtistSearching.value = false;
    } else {
      isSeedArtistSearching.value = true;
      _doSeedArtistSearch(q);
    }
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
