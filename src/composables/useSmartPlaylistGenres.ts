import { computed, onMounted, ref } from "vue";
import type { Ref } from "vue";
import api from "@/plugins/api";
import type { Genre } from "@/plugins/api/interfaces";

export function useSmartPlaylistGenres(
  ruleGenreIds: Ref<number[]>,
  ruleExcludedGenreIds: Ref<number[]>,
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
    get: () => ruleGenreIds.value.map(String),
    set: (vals: string[]) => {
      ruleGenreIds.value = vals.map(Number);
    },
  });

  const excludedGenreModelValue = computed({
    get: () => ruleExcludedGenreIds.value.map(String),
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
    const idx = ruleGenreIds.value.indexOf(id);
    if (idx >= 0) {
      ruleGenreIds.value.splice(idx, 1);
    } else {
      const excIdx = ruleExcludedGenreIds.value.indexOf(id);
      if (excIdx >= 0) ruleExcludedGenreIds.value.splice(excIdx, 1);
      ruleGenreIds.value.push(id);
    }
  }

  function toggleExcludedGenreById(id: number) {
    const excIdx = ruleExcludedGenreIds.value.indexOf(id);
    if (excIdx >= 0) {
      ruleExcludedGenreIds.value.splice(excIdx, 1);
    } else {
      const incIdx = ruleGenreIds.value.indexOf(id);
      if (incIdx >= 0) ruleGenreIds.value.splice(incIdx, 1);
      ruleExcludedGenreIds.value.push(id);
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
