import type { MediaItemChapter } from "@/plugins/api/interfaces";

export interface ChapterTick extends MediaItemChapter {
  // position along the track as percentage
  percent: number;
}

export interface ResolvedChapter {
  chapter: MediaItemChapter;
  start: number;
  end: number;
  duration: number;
}

/**
 * Resolve the chapter containing an absolute playback position.
 * Intervals are half-open (end belongs to the next chapter); the final chapter
 * remains active at media completion so chapter-relative UI stays stable.
 */
export function resolveCurrentChapter(
  chapters: MediaItemChapter[] | null | undefined,
  elapsedTime: number | null | undefined,
  mediaDuration: number | null | undefined,
): ResolvedChapter | undefined {
  if (
    elapsedTime == null ||
    !Number.isFinite(elapsedTime) ||
    !chapters?.length
  ) {
    return undefined;
  }

  const orderedChapters = chapters
    .map((chapter, index) => ({ chapter, index }))
    .filter(({ chapter }) => Number.isFinite(chapter.start))
    .sort((a, b) => a.chapter.start - b.chapter.start || a.index - b.index);

  for (let index = 0; index < orderedChapters.length; index += 1) {
    const chapter = orderedChapters[index].chapter;
    const nextStart = orderedChapters[index + 1]?.chapter.start;
    const end =
      chapter.end ?? nextStart ?? mediaDuration ?? Number.POSITIVE_INFINITY;
    if (end <= chapter.start) continue;
    const isFinalMediaPosition =
      mediaDuration != null &&
      Number.isFinite(mediaDuration) &&
      elapsedTime === mediaDuration &&
      end === mediaDuration;
    if (
      elapsedTime >= chapter.start &&
      (elapsedTime < end || isFinalMediaPosition)
    ) {
      return {
        chapter,
        start: chapter.start,
        end,
        duration: end - chapter.start,
      };
    }
  }

  return undefined;
}

/**
 * map media chapters to slider ticks, computing each chapter's start as a
 * percentage of the track, percentages are clamped to [0, 100]
 */
export function computeChapterTicks(
  chapters: MediaItemChapter[] | null | undefined,
  duration: number | null | undefined,
): ChapterTick[] {
  if (!duration || !chapters?.length) return [];
  return chapters.map((chapter) => ({
    ...chapter,
    percent: Math.min(100, Math.max(0, (chapter.start / duration) * 100)),
  }));
}
