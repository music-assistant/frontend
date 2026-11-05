import {
  MediaType,
  type MediaItemBookmark,
  type MediaItemChapter,
  type ProviderMapping,
} from "@/plugins/api/interfaces";

// the media types that can have chapters
export const isChapteredMediaType = (mediaType: MediaType | undefined) =>
  mediaType === MediaType.AUDIOBOOK || mediaType === MediaType.PODCAST_EPISODE;

export interface ChapterSegment {
  // undefined for the stretch before the first chapter starts
  chapter?: MediaItemChapter;
  start: number;
  end: number;
  // placement along the track as percentages
  startPercent: number;
  widthPercent: number;
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
 * split the track into one segment per chapter, each running to the next
 * chapter's start so the segments cover the whole track without overlaps
 */
export function computeChapterSegments(
  chapters: MediaItemChapter[] | null | undefined,
  duration: number | null | undefined,
): ChapterSegment[] {
  if (!duration || !chapters?.length) return [];
  const clamp = (seconds: number) => Math.min(duration, Math.max(0, seconds));
  const ordered = chapters
    .filter((chapter) => Number.isFinite(chapter.start))
    .sort((a, b) => a.start - b.start);
  if (!ordered.length) return [];

  const ranges: { chapter?: MediaItemChapter; start: number; end: number }[] =
    [];
  const firstStart = clamp(ordered[0].start);
  if (firstStart > 0) ranges.push({ start: 0, end: firstStart });
  ordered.forEach((chapter, index) => {
    const start = clamp(chapter.start);
    const next = ordered[index + 1];
    const end = next ? clamp(next.start) : duration;
    if (end > start) ranges.push({ chapter, start, end });
  });
  return ranges.map((range) => ({
    ...range,
    startPercent: (range.start / duration) * 100,
    widthPercent: ((range.end - range.start) / duration) * 100,
  }));
}

/** the segment holding a position in seconds */
export function segmentAt(
  segments: ChapterSegment[],
  seconds: number,
): ChapterSegment | undefined {
  return (
    segments.find((x) => seconds >= x.start && seconds < x.end) ??
    segments.at(-1)
  );
}

export interface ChapterBookmarks {
  // undefined for an item without chapters
  chapter?: MediaItemChapter;
  bookmarks: MediaItemBookmark[];
}

/**
 * whether the item's chapters fit the positions of its bookmarks: each copy may
 * have chapters of its own, and an item with several copies shows those of one
 */
export function chaptersFitBookmarks(item: {
  provider_mappings: ProviderMapping[];
}): boolean {
  return item.provider_mappings.length <= 1;
}

/**
 * place each bookmark under the last chapter starting at or before it, so it
 * shows where it is in the item; without chapters, or with chapters that do not
 * fit them, all bookmarks form one group after the chapters
 */
export function groupBookmarksByChapter(
  chapters: MediaItemChapter[] | null | undefined,
  bookmarks: MediaItemBookmark[],
  chaptersFit = true,
): ChapterBookmarks[] {
  const ordered = [...bookmarks].sort((a, b) => a.start - b.start);
  // in playing order, as the timeline shows them
  const orderedChapters = [...(chapters ?? [])].sort(
    (a, b) => a.start - b.start,
  );
  if (!orderedChapters.length || !chaptersFit) {
    return [
      ...orderedChapters.map((chapter) => ({ chapter, bookmarks: [] })),
      ...(ordered.length ? [{ bookmarks: ordered }] : []),
    ];
  }
  return orderedChapters.map((chapter, index) => ({
    chapter,
    bookmarks: ordered.filter(
      (x) =>
        (index === 0 || x.start >= chapter.start) &&
        (index === orderedChapters.length - 1 ||
          x.start < orderedChapters[index + 1].start),
    ),
  }));
}
