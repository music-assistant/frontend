import type { MusicQuizTimelineEntry } from "@/composables/useMusicQuiz";

export interface MusicQuizTimelineBoundary {
  previous_entry_id: string | null;
  next_entry_id: string | null;
  previousEntry: MusicQuizTimelineEntry | null;
  nextEntry: MusicQuizTimelineEntry | null;
}

export function getMusicQuizTimelineBoundaries(
  timeline: MusicQuizTimelineEntry[],
): MusicQuizTimelineBoundary[] {
  return Array.from({ length: timeline.length + 1 }, (_, index) => {
    const previousEntry = timeline[index - 1] ?? null;
    const nextEntry = timeline[index] ?? null;
    return {
      previous_entry_id: previousEntry?.entry_id ?? null,
      next_entry_id: nextEntry?.entry_id ?? null,
      previousEntry,
      nextEntry,
    };
  });
}

export function getMusicQuizTimelineBoundaryKey(
  boundary: Pick<
    MusicQuizTimelineBoundary,
    "previous_entry_id" | "next_entry_id"
  >,
) {
  return `${boundary.previous_entry_id ?? "start"}:${boundary.next_entry_id ?? "end"}`;
}
