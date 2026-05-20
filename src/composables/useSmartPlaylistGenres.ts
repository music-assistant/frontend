import { computed, onMounted, ref } from "vue";
import type { Ref } from "vue";
import api from "@/plugins/api";
import type { Genre } from "@/plugins/api/interfaces";

export function useSmartPlaylistGenres(
  ruleGenreIds: Ref<number[] | undefined>,
  ruleExcludedGenreIds: Ref<number[] | undefined>,
  ruleGenreNames: Ref<Record<number, string> | undefined>,
) {
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
    get: () => (ruleGenreIds.value ?? []).map(String),
    set: (vals: string[]) => {
      ruleGenreIds.value = vals.map(Number);
    },
  });

  const excludedGenreModelValue = computed({
    get: () => (ruleExcludedGenreIds.value ?? []).map(String),
    set: (vals: string[]) => {
      ruleExcludedGenreIds.value = vals.map(Number);
    },
  });

  onMounted(async () => {
    genres.value = await api.getLibraryGenres({ hide_empty: false });
  });

  function genreName(id: number): string {
    return (
      genres.value.find((g) => parseInt(g.item_id) === id)?.name ??
      ruleGenreNames.value?.[id] ??
      String(id)
    );
  }

  function toggleGenreById(id: number) {
    const genreIds = ruleGenreIds.value ?? [];
    const idx = genreIds.indexOf(id);
    if (idx >= 0) {
      genreIds.splice(idx, 1);
      ruleGenreIds.value = genreIds;
    } else {
      const excludedGenreIds = ruleExcludedGenreIds.value ?? [];
      const excIdx = excludedGenreIds.indexOf(id);
      if (excIdx >= 0) {
        excludedGenreIds.splice(excIdx, 1);
        ruleExcludedGenreIds.value = excludedGenreIds;
      }
      genreIds.push(id);
      ruleGenreIds.value = genreIds;
    }
  }

  function toggleExcludedGenreById(id: number) {
    const excludedGenreIds = ruleExcludedGenreIds.value ?? [];
    const excIdx = excludedGenreIds.indexOf(id);
    if (excIdx >= 0) {
      excludedGenreIds.splice(excIdx, 1);
      ruleExcludedGenreIds.value = excludedGenreIds;
    } else {
      const genreIds = ruleGenreIds.value ?? [];
      const incIdx = genreIds.indexOf(id);
      if (incIdx >= 0) {
        genreIds.splice(incIdx, 1);
        ruleGenreIds.value = genreIds;
      }
      excludedGenreIds.push(id);
      ruleExcludedGenreIds.value = excludedGenreIds;
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
