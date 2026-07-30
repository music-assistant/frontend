// Resolving "which row is the current one" for a queue.
//
// `current_index` is optional, and coalescing a missing one to 0 makes the first track look like
// it is playing. Two real states hit that: a queue that was loaded but never started, and a queue
// that played to its end (`ended`), which keeps its position on the last item so there is still
// evidence of what played.
import { PlayerQueue } from "@/plugins/api/interfaces";

// Sentinel for "the queue sits before its first item": no row is current, and everything is
// up next. Comparisons against a real absolute index never match it.
export const BEFORE_FIRST_INDEX = -1;

/**
 * Absolute index of the current row, as a value that is safe to compare and do arithmetic on.
 *
 * Returns a position *past* the last item for a queue that ended (every row has been played and
 * none is playing) and `BEFORE_FIRST_INDEX` for a queue that never started.
 */
export const currentQueueIndex = (queue?: PlayerQueue | null): number => {
  if (!queue) return BEFORE_FIRST_INDEX;
  if (queue.ended) return queue.items;
  return queue.current_index ?? BEFORE_FIRST_INDEX;
};

/** Whether the queue holds items it already played through and can start over. */
export const isQueueEnded = (queue?: PlayerQueue | null): boolean =>
  !!queue?.ended && queue.items > 0;
