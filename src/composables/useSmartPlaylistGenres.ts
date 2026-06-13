import { computed, onMounted, ref } from "vue";
import api from "@/plugins/api";
import type { Genre } from "@/plugins/api/interfaces";

export function useSmartPlaylistGenres() {
  const genres = ref<Genre[]>([]);

  onMounted(async () => {
    genres.value = await api.getLibraryGenres({ hide_empty: false });
  });

  const genreOptions = computed(() =>
    genres.value.map((g) => ({
      id: parseInt(g.item_id),
      name: g.name,
      item: g,
    })),
  );

  function genreName(id: number, fallback?: string): string {
    const genre = genres.value.find((g) => parseInt(g.item_id) === id);
    if (!genre) return fallback ?? String(id);
    return genre.name;
  }

  return { genres, genreOptions, genreName };
}
