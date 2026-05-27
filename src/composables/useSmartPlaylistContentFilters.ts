import { computed, ref } from "vue";
import type { Ref } from "vue";
import api from "@/plugins/api";
import type { Album, Artist } from "@/plugins/api/interfaces";
import { setupDebouncedSearch } from "./useSmartPlaylistSearchHelpers";

export function useSmartPlaylistContentFilters(
  ruleArtistIds: Ref<number[] | undefined>,
  ruleAlbumIds: Ref<number[] | undefined>,
  ruleExcludedArtistIds: Ref<number[] | undefined>,
  ruleExcludedAlbumIds: Ref<number[] | undefined>,
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
    const artistIds = ruleArtistIds.value ?? [];
    const idx = artistIds.indexOf(id);
    if (idx >= 0) {
      artistIds.splice(idx, 1);
      ruleArtistIds.value = artistIds;
      selectedArtistItems.value = selectedArtistItems.value.filter(
        (a) => a.id !== id,
      );
    } else if (name !== undefined) {
      const excIdx = selectedExcludedArtistItems.value.findIndex(
        (a) => a.id === id,
      );
      if (excIdx >= 0) {
        selectedExcludedArtistItems.value.splice(excIdx, 1);
        const excludedArtistIds = ruleExcludedArtistIds.value ?? [];
        const excludedIdx = excludedArtistIds.indexOf(id);
        if (excludedIdx >= 0) {
          excludedArtistIds.splice(excludedIdx, 1);
          ruleExcludedArtistIds.value = excludedArtistIds;
        }
      }
      artistIds.push(id);
      ruleArtistIds.value = artistIds;
      selectedArtistItems.value.push({ id, name });
    }
  }

  function toggleAlbumById(id: number, name?: string) {
    const albumIds = ruleAlbumIds.value ?? [];
    const idx = albumIds.indexOf(id);
    if (idx >= 0) {
      albumIds.splice(idx, 1);
      ruleAlbumIds.value = albumIds;
      selectedAlbumItems.value = selectedAlbumItems.value.filter(
        (a) => a.id !== id,
      );
    } else if (name !== undefined) {
      const excIdx = selectedExcludedAlbumItems.value.findIndex(
        (a) => a.id === id,
      );
      if (excIdx >= 0) {
        selectedExcludedAlbumItems.value.splice(excIdx, 1);
        const excludedAlbumIds = ruleExcludedAlbumIds.value ?? [];
        const excludedIdx = excludedAlbumIds.indexOf(id);
        if (excludedIdx >= 0) {
          excludedAlbumIds.splice(excludedIdx, 1);
          ruleExcludedAlbumIds.value = excludedAlbumIds;
        }
      }
      albumIds.push(id);
      ruleAlbumIds.value = albumIds;
      selectedAlbumItems.value.push({ id, name });
    }
  }

  function toggleExcludedArtistById(id: number, name?: string) {
    const excludedArtistIds = ruleExcludedArtistIds.value ?? [];
    const idx = excludedArtistIds.indexOf(id);
    if (idx >= 0) {
      excludedArtistIds.splice(idx, 1);
      ruleExcludedArtistIds.value = excludedArtistIds;
      selectedExcludedArtistItems.value =
        selectedExcludedArtistItems.value.filter((a) => a.id !== id);
    } else if (name !== undefined) {
      const artistIds = ruleArtistIds.value ?? [];
      const incIdx = artistIds.indexOf(id);
      if (incIdx >= 0) {
        artistIds.splice(incIdx, 1);
        ruleArtistIds.value = artistIds;
        selectedArtistItems.value = selectedArtistItems.value.filter(
          (a) => a.id !== id,
        );
      }
      excludedArtistIds.push(id);
      ruleExcludedArtistIds.value = excludedArtistIds;
      selectedExcludedArtistItems.value.push({ id, name });
    }
  }

  function toggleExcludedAlbumById(id: number, name?: string) {
    const excludedAlbumIds = ruleExcludedAlbumIds.value ?? [];
    const idx = excludedAlbumIds.indexOf(id);
    if (idx >= 0) {
      excludedAlbumIds.splice(idx, 1);
      ruleExcludedAlbumIds.value = excludedAlbumIds;
      selectedExcludedAlbumItems.value =
        selectedExcludedAlbumItems.value.filter((a) => a.id !== id);
    } else if (name !== undefined) {
      const albumIds = ruleAlbumIds.value ?? [];
      const incIdx = albumIds.indexOf(id);
      if (incIdx >= 0) {
        albumIds.splice(incIdx, 1);
        ruleAlbumIds.value = albumIds;
        selectedAlbumItems.value = selectedAlbumItems.value.filter(
          (a) => a.id !== id,
        );
      }
      excludedAlbumIds.push(id);
      ruleExcludedAlbumIds.value = excludedAlbumIds;
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
