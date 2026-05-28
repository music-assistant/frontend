import { computed, onMounted, ref } from "vue";
import api from "@/plugins/api";
import type { Genre } from "@/plugins/api/interfaces";

export function useSmartPlaylistGenres() {
  const genres = ref<Genre[]>([]);

  onMounted(async () => {
    genres.value = await api.getLibraryGenres({ hide_empty: false });
  });

  const genreOptions = computed(() =>
    genres.value.map((g) => ({ id: parseInt(g.item_id), name: g.name })),
  );

  function genreName(id: number, fallback?: string): string {
    return (
      genres.value.find((g) => parseInt(g.item_id) === id)?.name ??
      fallback ??
      String(id)
    );
  }

  return { genres, genreOptions, genreName };
}
