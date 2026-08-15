import { resolveActiveElapsedTime } from "@/helpers/activeElapsedTime";
import { resolveCurrentChapter } from "@/helpers/chapters";
import { useUserPreferences } from "@/composables/userPreferences";
import {
  MediaItemChapter,
  MediaType,
  PlaybackState,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, onUnmounted, ref, watch } from "vue";

export type ChapterNavigationDirection = "previous" | "next";

/**
 * Resolves chapter-aware previous/next targets without changing queue state.
 * At the first or last chapter, the target is undefined so callers can fall
 * back to the player's normal previous/next command.
 */
export function useChapterNavigation() {
  const { getPreference } = useUserPreferences();
  const showChapterProgress = getPreference(
    "audiobook_chapter_progress",
    false,
  );
  const nowTick = ref(0);
  let chapterTimer: ReturnType<typeof setInterval> | null = null;

  const chapterMode = computed(() => {
    const player = store.activePlayer;
    const media = player?.current_media;
    const queueItem = store.curQueueItem;
    return (
      showChapterProgress.value &&
      (media?.media_type === MediaType.AUDIOBOOK ||
        media?.media_type === MediaType.PODCAST_EPISODE) &&
      !!queueItem?.media_item?.metadata?.chapters?.length &&
      (media.queue_item_id == null ||
        media.queue_item_id === queueItem.queue_item_id)
    );
  });

  const chapterTimerActive = computed(
    () =>
      chapterMode.value &&
      store.activePlayer?.playback_state === PlaybackState.PLAYING,
  );

  const getTargetChapter = (
    direction: ChapterNavigationDirection,
  ): MediaItemChapter | undefined => {
    void nowTick.value;
    if (!chapterMode.value || !store.activePlayer) return undefined;

    const media = store.activePlayer.current_media;
    const chapters = store.curQueueItem?.media_item?.metadata?.chapters;
    const current = resolveCurrentChapter(
      chapters,
      resolveActiveElapsedTime(),
      media?.duration,
    );
    if (!current || !chapters) return undefined;

    const ordered = chapters
      .map((chapter, index) => ({ chapter, index }))
      .filter(({ chapter }) => Number.isFinite(chapter.start))
      .sort((a, b) => a.chapter.start - b.chapter.start || a.index - b.index)
      .map(({ chapter }) => chapter);
    const currentIndex = ordered.indexOf(current.chapter);
    if (currentIndex < 0) return undefined;

    return ordered[currentIndex + (direction === "previous" ? -1 : 1)];
  };

  const previousChapter = computed(() => getTargetChapter("previous"));
  const nextChapter = computed(() => getTargetChapter("next"));

  const updateChapterTimer = (needed: boolean) => {
    if (needed && chapterTimer === null) {
      chapterTimer = setInterval(() => {
        nowTick.value = Date.now();
      }, 1000);
    } else if (!needed && chapterTimer !== null) {
      clearInterval(chapterTimer);
      chapterTimer = null;
    }
  };

  watch(chapterTimerActive, updateChapterTimer, { immediate: true });
  onUnmounted(() => updateChapterTimer(false));

  return {
    chapterMode,
    previousChapter,
    nextChapter,
  };
}
