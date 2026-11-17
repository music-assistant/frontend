import type { PlayerQueue } from "@/plugins/api/interfaces";

// Items up to this index can't be moved or removed, null while nothing is buffered.
export const lastLockedIndex = (queue: PlayerQueue): number | null => {
  const index = queue.extra_attributes?.last_locked_index;
  return typeof index === "number" ? index : null;
};
