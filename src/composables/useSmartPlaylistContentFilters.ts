import { computed, ref } from "vue";
import type { Ref } from "vue";
import api from "@/plugins/api";
import type { Album, Artist } from "@/plugins/api/interfaces";
import { setupDebouncedSearch } from "./useSmartPlaylistSearchHelpers";

export function useSmartPlaylistContentFilters(
  ruleArtistIds: Ref<number[]>,
  ruleAlbumIds: Ref<number[]>,
  ruleExcludedArtistIds: Ref<number[]>,
  ruleExcludedAlbumIds: Ref<number[]>,
) {
  const artistSearch = ref("");
  const artistResults = ref<Artist[]>([]);
  const isArtistSearching = ref(false);
  const albumSearch = ref("");
  const albumResults = ref<Album[]>([]);
  const isAlbumSearching = ref(false);

  const selectedArtistItems = ref<{ id: number; name: string }[]>([]);
  const selectedAlbumItems = ref<{ id: number; name: string }[]>([]);

  const selectedExcludedArtistItems = ref<{ id: number; name: string }[]>([]);
  const selectedExcludedAlbumItems = ref<{ id: number; name: string }[]>([]);
  const excludedArtistSearch = ref("");
  const excludedArtistResults = ref<Artist[]>([]);
  const isExcludedArtistSearching = ref(false);
  const excludedAlbumSearch = ref("");
  const excludedAlbumResults = ref<Album[]>([]);
  const isExcludedAlbumSearching = ref(false);

  const artistModelValue = computed({
    get: () => selectedArtistItems.value.map((a) => String(a.id)),
    set: (vals: string[]) => {
      selectedArtistItems.value = selectedArtistItems.value.filter((a) =>
        vals.includes(String(a.id)),
      );
      ruleArtistIds.value = selectedArtistItems.value.map((a) => a.id);
    },
  });

  const albumModelValue = computed({
    get: () => selectedAlbumItems.value.map((a) => String(a.id)),
    set: (vals: string[]) => {
      selectedAlbumItems.value = selectedAlbumItems.value.filter((a) =>
        vals.includes(String(a.id)),
      );
      ruleAlbumIds.value = selectedAlbumItems.value.map((a) => a.id);
    },
  });

  const excludedArtistModelValue = computed({
    get: () => selectedExcludedArtistItems.value.map((a) => String(a.id)),
    set: (vals: string[]) => {
      selectedExcludedArtistItems.value =
        selectedExcludedArtistItems.value.filter((a) =>
          vals.includes(String(a.id)),
        );
      ruleExcludedArtistIds.value = selectedExcludedArtistItems.value.map(
        (a) => a.id,
      );
    },
  });

  const excludedAlbumModelValue = computed({
    get: () => selectedExcludedAlbumItems.value.map((a) => String(a.id)),
    set: (vals: string[]) => {
      selectedExcludedAlbumItems.value =
        selectedExcludedAlbumItems.value.filter((a) =>
          vals.includes(String(a.id)),
        );
      ruleExcludedAlbumIds.value = selectedExcludedAlbumItems.value.map(
        (a) => a.id,
      );
    },
  });

  setupDebouncedSearch({
    query: artistSearch,
    results: artistResults,
    isSearching: isArtistSearching,
    searchFn: (q) => api.getLibraryArtists(undefined, q, 20),
  });

  setupDebouncedSearch({
    query: albumSearch,
    results: albumResults,
    isSearching: isAlbumSearching,
    searchFn: (q) => api.getLibraryAlbums(undefined, q, 20),
  });

  setupDebouncedSearch({
    query: excludedArtistSearch,
    results: excludedArtistResults,
    isSearching: isExcludedArtistSearching,
    searchFn: (q) => api.getLibraryArtists(undefined, q, 20),
  });

  setupDebouncedSearch({
    query: excludedAlbumSearch,
    results: excludedAlbumResults,
    isSearching: isExcludedAlbumSearching,
    searchFn: (q) => api.getLibraryAlbums(undefined, q, 20),
  });

  function toggleArtistById(id: number, name?: string) {
    const idx = ruleArtistIds.value.indexOf(id);
    if (idx >= 0) {
      ruleArtistIds.value.splice(idx, 1);
      selectedArtistItems.value = selectedArtistItems.value.filter(
        (a) => a.id !== id,
      );
    } else if (name !== undefined) {
      const excIdx = selectedExcludedArtistItems.value.findIndex(
        (a) => a.id === id,
      );
      if (excIdx >= 0) {
        selectedExcludedArtistItems.value.splice(excIdx, 1);
        const excludedIdx = ruleExcludedArtistIds.value.indexOf(id);
        if (excludedIdx >= 0)
          ruleExcludedArtistIds.value.splice(excludedIdx, 1);
      }
      ruleArtistIds.value.push(id);
      selectedArtistItems.value.push({ id, name });
    }
  }

  function toggleAlbumById(id: number, name?: string) {
    const idx = ruleAlbumIds.value.indexOf(id);
    if (idx >= 0) {
      ruleAlbumIds.value.splice(idx, 1);
      selectedAlbumItems.value = selectedAlbumItems.value.filter(
        (a) => a.id !== id,
      );
    } else if (name !== undefined) {
      const excIdx = selectedExcludedAlbumItems.value.findIndex(
        (a) => a.id === id,
      );
      if (excIdx >= 0) {
        selectedExcludedAlbumItems.value.splice(excIdx, 1);
        const excludedIdx = ruleExcludedAlbumIds.value.indexOf(id);
        if (excludedIdx >= 0) ruleExcludedAlbumIds.value.splice(excludedIdx, 1);
      }
      ruleAlbumIds.value.push(id);
      selectedAlbumItems.value.push({ id, name });
    }
  }

  function toggleExcludedArtistById(id: number, name?: string) {
    const idx = ruleExcludedArtistIds.value.indexOf(id);
    if (idx >= 0) {
      ruleExcludedArtistIds.value.splice(idx, 1);
      selectedExcludedArtistItems.value =
        selectedExcludedArtistItems.value.filter((a) => a.id !== id);
    } else if (name !== undefined) {
      const incIdx = ruleArtistIds.value.indexOf(id);
      if (incIdx >= 0) {
        ruleArtistIds.value.splice(incIdx, 1);
        selectedArtistItems.value = selectedArtistItems.value.filter(
          (a) => a.id !== id,
        );
      }
      ruleExcludedArtistIds.value.push(id);
      selectedExcludedArtistItems.value.push({ id, name });
    }
  }

  function toggleExcludedAlbumById(id: number, name?: string) {
    const idx = ruleExcludedAlbumIds.value.indexOf(id);
    if (idx >= 0) {
      ruleExcludedAlbumIds.value.splice(idx, 1);
      selectedExcludedAlbumItems.value =
        selectedExcludedAlbumItems.value.filter((a) => a.id !== id);
    } else if (name !== undefined) {
      const incIdx = ruleAlbumIds.value.indexOf(id);
      if (incIdx >= 0) {
        ruleAlbumIds.value.splice(incIdx, 1);
        selectedAlbumItems.value = selectedAlbumItems.value.filter(
          (a) => a.id !== id,
        );
      }
      ruleExcludedAlbumIds.value.push(id);
      selectedExcludedAlbumItems.value.push({ id, name });
    }
  }

  return {
    artistSearch,
    artistResults,
    isArtistSearching,
    albumSearch,
    albumResults,
    isAlbumSearching,
    selectedArtistItems,
    selectedAlbumItems,
    selectedExcludedArtistItems,
    selectedExcludedAlbumItems,
    excludedArtistSearch,
    excludedArtistResults,
    isExcludedArtistSearching,
    excludedAlbumSearch,
    excludedAlbumResults,
    isExcludedAlbumSearching,
    artistModelValue,
    albumModelValue,
    excludedArtistModelValue,
    excludedAlbumModelValue,
    toggleArtistById,
    toggleAlbumById,
    toggleExcludedArtistById,
    toggleExcludedAlbumById,
  };
}
