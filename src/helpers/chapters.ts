import type { MediaItemChapter } from "@/plugins/api/interfaces";

export interface ChapterTick extends MediaItemChapter {
  // position along the track as percentage
  percent: number;
}

/**
 * map media chapters to slider ticks, computing each chapter's start as a
 * percentage of the track, percentages are clamped to [0, 100]
 */
export function computeChapterTicks(
  chapters: MediaItemChapter[] | undefined,
  duration: number | undefined,
): ChapterTick[] {
  if (!duration || !chapters?.length) return [];
  return chapters.map((chapter) => ({
    ...chapter,
    percent: Math.min(100, Math.max(0, (chapter.start / duration) * 100)),
  }));
}
