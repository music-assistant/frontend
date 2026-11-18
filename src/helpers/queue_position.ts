// Resolving "which row is the current one" for a queue.
//
// `current_index` is optional, and coalescing a missing one to 0 makes the first track look like
// it is playing. Two real states hit that: a queue that was loaded but never started, and a queue
// that played to its end (`ended`), which keeps its position on the last item so there is still
// evidence of what played.
import { PlayerQueue, QueueItem } from "@/plugins/api/interfaces";

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

/**
 * Move the item at one index of a sparsely loaded list to another, shifting the
 * items in between by one. An item that is not loaded leaves a hole where it lands.
 */
export const moveSparseItem = <T>(
  items: Map<number, T>,
  from: number,
  to: number,
): void => {
  const moved = items.get(from);
  const step = from < to ? 1 : -1;
  for (let index = from; index !== to; index += step) {
    setOrDelete(items, index, items.get(index + step));
  }
  setOrDelete(items, to, moved);
};

/** URIs a party guest may not request again, empty when "Prevent Duplicate Tracks" is off. */
export const queuedGuestTrackUris = (
  queueItems: QueueItem[],
  preventDuplicateTracks: boolean,
): Set<string> => {
  const uris = new Set<string>();
  if (!preventDuplicateTracks) return uris;
  for (const item of queueItems) {
    if (item.media_item?.uri) uris.add(item.media_item.uri);
  }
  return uris;
};

const setOrDelete = <T>(
  items: Map<number, T>,
  index: number,
  item: T | undefined,
): void => {
  if (item === undefined) items.delete(index);
  else items.set(index, item);
};
