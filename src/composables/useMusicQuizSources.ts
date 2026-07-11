import { getMusicQuizSourceSummary } from "@/helpers/music_quiz_sources";
import type { Playlist, Track } from "@/plugins/api/interfaces";
import { computed, ref } from "vue";

export type MusicQuizSourceItem = Track | Playlist;

/**
 * Selection management for the tracks/playlists a Music Quiz is played from.
 * Searching happens in the MediaSearch component; this only holds what the
 * user picked.
 */
export function useMusicQuizSources() {
  const selected = ref<MusicQuizSourceItem[]>([]);

  const sourceUris = computed(() => selected.value.map((item) => item.uri));
  const summary = computed(() => getMusicQuizSourceSummary(selected.value));
  const canCreate = computed(() => sourceUris.value.length > 0);

  function add(item: MusicQuizSourceItem) {
    if (selected.value.some((source) => source.uri === item.uri)) return;
    selected.value.push(item);
  }

  function remove(uri: string) {
    selected.value = selected.value.filter((source) => source.uri !== uri);
  }

  return {
    selected,
    sourceUris,
    summary,
    canCreate,
    add,
    remove,
  };
}
