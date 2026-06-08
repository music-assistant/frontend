import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import api from "@/plugins/api";
import type { Genre } from "@/plugins/api/interfaces";
import { getGenreDisplayName } from "@/helpers/utils";

export function useSmartPlaylistGenres() {
  const genres = ref<Genre[]>([]);
  const { t, te } = useI18n();

  onMounted(async () => {
    genres.value = await api.getLibraryGenres({ hide_empty: false });
  });

  const genreOptions = computed(() =>
    genres.value.map((g) => ({
      id: parseInt(g.item_id),
      name: getGenreDisplayName(g.name, g.translation_key, t, te),
      item: g,
    })),
  );

  function genreName(id: number, fallback?: string): string {
    const genre = genres.value.find((g) => parseInt(g.item_id) === id);
    if (!genre) return fallback ?? String(id);
    return getGenreDisplayName(genre.name, genre.translation_key, t, te);
  }

  return { genres, genreOptions, genreName };
}
