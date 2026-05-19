import { computed, onMounted, ref, watch } from "vue";
import api from "@/plugins/api";
import type { Genre, SmartPlaylistRules } from "@/plugins/api/interfaces";

export function useSmartPlaylistGenres() {
  const genres = ref<Genre[]>([]);
  const genreSearch = ref("");
  const excludedGenreSearch = ref("");

  const filteredGenres = computed(() =>
    genreSearch.value
      ? genres.value.filter((g) =>
          g.name.toLowerCase().includes(genreSearch.value.toLowerCase()),
        )
      : genres.value,
  );

  const filteredExcludedGenres = computed(() => {
    const base = excludedGenreSearch.value
      ? genres.value.filter((g) =>
          g.name
            .toLowerCase()
            .includes(excludedGenreSearch.value.toLowerCase()),
        )
      : genres.value;
    return base;
  });

  const genreModelValue = computed({
    get: () => {
      // This will be set via context in parent
      return [] as string[];
    },
    set: () => {
      // Will be implemented in parent
    },
  });

  const excludedGenreModelValue = computed({
    get: () => {
      // This will be set via context in parent
      return [] as string[];
    },
    set: () => {
      // Will be implemented in parent
    },
  });

  onMounted(async () => {
    genres.value = await api.getLibraryGenres({ hide_empty: false });
  });

  function genreName(id: number, genreNames?: Record<number, string>): string {
    return (
      genres.value.find((g) => parseInt(g.item_id) === id)?.name ??
      genreNames?.[id] ??
      String(id)
    );
  }

  function toggleGenreById(
    id: number,
    ruleGenreIds: number[],
    ruleExcludedGenreIds: number[],
  ) {
    const idx = ruleGenreIds.indexOf(id);
    if (idx >= 0) {
      ruleGenreIds.splice(idx, 1);
    } else {
      const excIdx = ruleExcludedGenreIds.indexOf(id);
      if (excIdx >= 0) ruleExcludedGenreIds.splice(excIdx, 1);
      ruleGenreIds.push(id);
    }
  }

  function toggleExcludedGenreById(
    id: number,
    ruleGenreIds: number[],
    ruleExcludedGenreIds: number[],
  ) {
    const excIdx = ruleExcludedGenreIds.indexOf(id);
    if (excIdx >= 0) {
      ruleExcludedGenreIds.splice(excIdx, 1);
    } else {
      const incIdx = ruleGenreIds.indexOf(id);
      if (incIdx >= 0) ruleGenreIds.splice(incIdx, 1);
      ruleExcludedGenreIds.push(id);
    }
  }

  return {
    genres,
    genreSearch,
    excludedGenreSearch,
    filteredGenres,
    filteredExcludedGenres,
    genreModelValue,
    excludedGenreModelValue,
    genreName,
    toggleGenreById,
    toggleExcludedGenreById,
  };
}
