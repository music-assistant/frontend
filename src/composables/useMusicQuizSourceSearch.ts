import { getMusicQuizSourceSummary } from "@/helpers/music_quiz_sources";
import api from "@/plugins/api";
import { MediaType, type Playlist, type Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { toast } from "vue-sonner";

export type MusicQuizSourceItem = Track | Playlist;

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_RESULT_LIMIT = 8;

/**
 * Debounced track/playlist search with selection management for Music Quiz
 * setup. Stale searches are discarded so the latest query always wins, and the
 * pending timer is cleaned up on unmount.
 */
export function useMusicQuizSourceSearch() {
  const query = ref("");
  const results = ref<MusicQuizSourceItem[]>([]);
  const selected = ref<MusicQuizSourceItem[]>([]);
  const searching = ref(false);

  const sourceUris = computed(() => selected.value.map((item) => item.uri));
  const summary = computed(() => getMusicQuizSourceSummary(selected.value));
  const canCreate = computed(() => sourceUris.value.length > 0);

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  function add(item: MusicQuizSourceItem) {
    if (selected.value.some((source) => source.uri === item.uri)) return;
    selected.value.push(item);
    results.value = results.value.filter((result) => result.uri !== item.uri);
  }

  function remove(uri: string) {
    selected.value = selected.value.filter((source) => source.uri !== uri);
    scheduleSearch();
  }

  function scheduleSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(search, SEARCH_DEBOUNCE_MS);
  }

  async function search() {
    const currentRequestId = ++requestId;
    const trimmed = query.value.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      results.value = [];
      searching.value = false;
      return;
    }
    searching.value = true;
    try {
      const result = await api.search(
        trimmed,
        [MediaType.TRACK, MediaType.PLAYLIST],
        SEARCH_RESULT_LIMIT,
      );
      if (currentRequestId !== requestId) return;
      const selectedUris = new Set(selected.value.map((item) => item.uri));
      results.value = [...result.tracks, ...result.playlists].filter(
        (item) => !selectedUris.has(item.uri),
      );
    } catch (err) {
      if (currentRequestId !== requestId) return;
      toast.error(
        err instanceof Error
          ? err.message
          : $t("providers.music_quiz.source_search_failed"),
      );
    } finally {
      if (currentRequestId === requestId) {
        searching.value = false;
      }
    }
  }

  watch(query, () => scheduleSearch());

  onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
  });

  return {
    query,
    results,
    selected,
    searching,
    sourceUris,
    summary,
    canCreate,
    minSearchLength: MIN_SEARCH_LENGTH,
    add,
    remove,
  };
}
