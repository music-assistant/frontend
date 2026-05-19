import { computed, ref, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import api from "@/plugins/api";
import type { Album, Artist } from "@/plugins/api/interfaces";

export function useSmartPlaylistContentFilters() {
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
    },
  });

  const albumModelValue = computed({
    get: () => selectedAlbumItems.value.map((a) => String(a.id)),
    set: (vals: string[]) => {
      selectedAlbumItems.value = selectedAlbumItems.value.filter((a) =>
        vals.includes(String(a.id)),
      );
    },
  });

  const excludedArtistModelValue = computed({
    get: () => selectedExcludedArtistItems.value.map((a) => String(a.id)),
    set: (vals: string[]) => {
      selectedExcludedArtistItems.value =
        selectedExcludedArtistItems.value.filter((a) =>
          vals.includes(String(a.id)),
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
    },
  });

  const _doArtistSearch = useDebounceFn(async (q: string) => {
    if (q.length >= 2) {
      isArtistSearching.value = true;
      try {
        const result = await api.getLibraryArtists(undefined, q, 20);
        if (artistSearch.value === q) artistResults.value = result;
      } finally {
        isArtistSearching.value = false;
      }
    } else {
      artistResults.value = [];
    }
  }, 400);

  watch(artistSearch, (q) => {
    if (q.length < 2) {
      artistResults.value = [];
      isArtistSearching.value = false;
    } else {
      isArtistSearching.value = true;
      _doArtistSearch(q);
    }
  });

  const _doAlbumSearch = useDebounceFn(async (q: string) => {
    if (q.length >= 2) {
      isAlbumSearching.value = true;
      try {
        const result = await api.getLibraryAlbums(undefined, q, 20);
        if (albumSearch.value === q) albumResults.value = result;
      } finally {
        isAlbumSearching.value = false;
      }
    } else {
      albumResults.value = [];
    }
  }, 400);

  watch(albumSearch, (q) => {
    if (q.length < 2) {
      albumResults.value = [];
      isAlbumSearching.value = false;
    } else {
      isAlbumSearching.value = true;
      _doAlbumSearch(q);
    }
  });

  const _doExcludedArtistSearch = useDebounceFn(async (q: string) => {
    if (q.length >= 2) {
      isExcludedArtistSearching.value = true;
      try {
        const result = await api.getLibraryArtists(undefined, q, 20);
        if (excludedArtistSearch.value === q)
          excludedArtistResults.value = result;
      } finally {
        isExcludedArtistSearching.value = false;
      }
    } else {
      excludedArtistResults.value = [];
    }
  }, 400);

  watch(excludedArtistSearch, (q) => {
    if (q.length < 2) {
      excludedArtistResults.value = [];
      isExcludedArtistSearching.value = false;
    } else {
      isExcludedArtistSearching.value = true;
      _doExcludedArtistSearch(q);
    }
  });

  const _doExcludedAlbumSearch = useDebounceFn(async (q: string) => {
    if (q.length >= 2) {
      isExcludedAlbumSearching.value = true;
      try {
        const result = await api.getLibraryAlbums(undefined, q, 20);
        if (excludedAlbumSearch.value === q)
          excludedAlbumResults.value = result;
      } finally {
        isExcludedAlbumSearching.value = false;
      }
    } else {
      excludedAlbumResults.value = [];
    }
  }, 400);

  watch(excludedAlbumSearch, (q) => {
    if (q.length < 2) {
      excludedAlbumResults.value = [];
      isExcludedAlbumSearching.value = false;
    } else {
      isExcludedAlbumSearching.value = true;
      _doExcludedAlbumSearch(q);
    }
  });

  function toggleArtistById(
    id: number,
    name?: string,
    ruleArtistIds?: number[],
  ) {
    if (!ruleArtistIds) return;
    const idx = ruleArtistIds.indexOf(id);
    if (idx >= 0) {
      ruleArtistIds.splice(idx, 1);
      selectedArtistItems.value = selectedArtistItems.value.filter(
        (a) => a.id !== id,
      );
    } else if (name !== undefined) {
      const excIdx = selectedExcludedArtistItems.value.findIndex(
        (a) => a.id === id,
      );
      if (excIdx >= 0) {
        selectedExcludedArtistItems.value.splice(excIdx, 1);
      }
      ruleArtistIds.push(id);
      selectedArtistItems.value.push({ id, name });
    }
  }

  function toggleAlbumById(id: number, name?: string, ruleAlbumIds?: number[]) {
    if (!ruleAlbumIds) return;
    const idx = ruleAlbumIds.indexOf(id);
    if (idx >= 0) {
      ruleAlbumIds.splice(idx, 1);
      selectedAlbumItems.value = selectedAlbumItems.value.filter(
        (a) => a.id !== id,
      );
    } else if (name !== undefined) {
      const excIdx = selectedExcludedAlbumItems.value.findIndex(
        (a) => a.id === id,
      );
      if (excIdx >= 0) {
        selectedExcludedAlbumItems.value.splice(excIdx, 1);
      }
      ruleAlbumIds.push(id);
      selectedAlbumItems.value.push({ id, name });
    }
  }

  function toggleExcludedArtistById(
    id: number,
    name?: string,
    ruleExcludedArtistIds?: number[],
    ruleArtistIds?: number[],
  ) {
    if (!ruleExcludedArtistIds) return;
    const idx = ruleExcludedArtistIds.indexOf(id);
    if (idx >= 0) {
      ruleExcludedArtistIds.splice(idx, 1);
      selectedExcludedArtistItems.value =
        selectedExcludedArtistItems.value.filter((a) => a.id !== id);
    } else if (name !== undefined) {
      if (ruleArtistIds) {
        const incIdx = ruleArtistIds.indexOf(id);
        if (incIdx >= 0) {
          ruleArtistIds.splice(incIdx, 1);
          selectedArtistItems.value = selectedArtistItems.value.filter(
            (a) => a.id !== id,
          );
        }
      }
      ruleExcludedArtistIds.push(id);
      selectedExcludedArtistItems.value.push({ id, name });
    }
  }

  function toggleExcludedAlbumById(
    id: number,
    name?: string,
    ruleExcludedAlbumIds?: number[],
    ruleAlbumIds?: number[],
  ) {
    if (!ruleExcludedAlbumIds) return;
    const idx = ruleExcludedAlbumIds.indexOf(id);
    if (idx >= 0) {
      ruleExcludedAlbumIds.splice(idx, 1);
      selectedExcludedAlbumItems.value =
        selectedExcludedAlbumItems.value.filter((a) => a.id !== id);
    } else if (name !== undefined) {
      if (ruleAlbumIds) {
        const incIdx = ruleAlbumIds.indexOf(id);
        if (incIdx >= 0) {
          ruleAlbumIds.splice(incIdx, 1);
          selectedAlbumItems.value = selectedAlbumItems.value.filter(
            (a) => a.id !== id,
          );
        }
      }
      ruleExcludedAlbumIds.push(id);
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
