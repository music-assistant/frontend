import computeElapsedTime from "@/helpers/elapsed";
import { store } from "@/plugins/store";
import { computed } from "vue";

export const currentChapter = computed(() => {
  const mediaItem = store.curQueueItem?.media_item;
  if (!mediaItem) return undefined;
  const chapters = mediaItem.metadata?.chapters;
  if (!chapters) return undefined;
  const queue = store.activePlayerQueue;
  let elapsedTime = 0;
  if (queue?.elapsed_time != null && queue?.elapsed_time_last_updated != null) {
    elapsedTime =
      computeElapsedTime(
        queue.elapsed_time,
        queue.elapsed_time_last_updated,
        store.activePlayer?.playback_state,
      ) ?? 0;
  }
  // chapters are sorted by position already
  let _elapsedChapterTime = 0;
  for (let i = 0; i < chapters.length; ++i) {
    const chapter = chapters[i];
    if (i === chapters.length - 1) {
      return chapter;
    }
    _elapsedChapterTime += chapters[i + 1].start - chapter.start;
    if (elapsedTime <= _elapsedChapterTime) {
      return chapter;
    }
  }
  return undefined;
});
