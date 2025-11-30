import { computed, ref } from "vue";
import type { Genre } from "@/plugins/api/interfaces";
import { useGenresApi } from "@/composables/useGenresApi";

// Shared state
const genres = ref<Genre[]>([]);
const currentGenre = ref<Genre | null>(null);
const loading = ref(false);
const searchResults = ref<Genre[]>([]);

export const useGenresStore = () => {
  const api = useGenresApi();

  // Getters
  const favoriteGenres = computed(() => genres.value.filter((g) => g.favorite));

  // Actions
  const loadGenres = async () => {
    loading.value = true;
    try {
      genres.value = await api.getGenres();
    } finally {
      loading.value = false;
    }
  };

  const loadGenre = async (id: number | string) => {
    loading.value = true;
    try {
      const numericId = typeof id === "string" ? parseInt(id) : id;
      const result = await api.getGenre(numericId);
      if (result && result.media_type === "genre") {
        currentGenre.value = result as Genre;
      }
    } finally {
      loading.value = false;
    }
  };

  const searchGenres = async (query: string) => {
    const results = await api.searchGenres(query);
    searchResults.value = results.genres || [];
  };

  const addAlias = async (genreId: number, alias: string) => {
    await api.addAlias(genreId, alias);
    // Reload genre to get updated data
    if (
      currentGenre.value &&
      parseInt(currentGenre.value.item_id) === genreId
    ) {
      await loadGenre(genreId);
    }
  };

  const createGenre = async (name: string) => {
    const newGenre = await api.createGenre(name);
    await loadGenres();
    return newGenre;
  };

  const removeAlias = async (genreId: number, alias: string) => {
    await api.removeAlias(alias);
    // Reload genre to get updated data
    if (
      currentGenre.value &&
      parseInt(currentGenre.value.item_id) === genreId
    ) {
      await loadGenre(genreId);
    }
  };

  const deleteGenre = async (genreId: number) => {
    await api.deleteGenre(genreId);
    await loadGenres();
    if (
      currentGenre.value &&
      parseInt(currentGenre.value.item_id) === genreId
    ) {
      currentGenre.value = null;
    }
  };

  const mergeGenres = async (
    sourceGenreIds: number[],
    targetGenreId: number,
  ) => {
    await api.mergeGenres(sourceGenreIds, targetGenreId);
    await loadGenres();
  };

  const splitGenre = async (genreId: number, alias: string) => {
    await api.splitGenre(genreId, alias);
    // Reload genre to get updated data
    if (
      currentGenre.value &&
      parseInt(currentGenre.value.item_id) === genreId
    ) {
      await loadGenre(genreId);
    }
  };

  const updateGenre = async (genre: Genre) => {
    await api.updateGenre(genre);
    await loadGenres();
    if (currentGenre.value && currentGenre.value.item_id === genre.item_id) {
      await loadGenre(genre.item_id);
    }
  };

  const toggleFavorite = async (genreId: number | string) => {
    const idStr = genreId.toString();
    const genre =
      genres.value.find((g) => g.item_id === idStr) ||
      (currentGenre.value?.item_id === idStr ? currentGenre.value : null);

    if (genre) {
      await api.toggleFavorite(genre);
    }
  };

  return {
    genres,
    currentGenre,
    loading,
    searchResults,
    favoriteGenres,
    loadGenres,
    loadGenre,
    searchGenres,
    addAlias,
    createGenre,
    removeAlias,
    deleteGenre,
    mergeGenres,
    splitGenre,
    updateGenre,
    toggleFavorite,
  };
};
