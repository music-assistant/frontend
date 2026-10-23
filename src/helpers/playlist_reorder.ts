import type { MediaItemType } from "@/plugins/api/interfaces";

/** The 1-based playlist position of a listed item, or undefined without one. */
export const playlistPosition = (item: MediaItemType): number | undefined =>
  "position" in item && typeof item.position === "number"
    ? item.position
    : undefined;

/**
 * Whether the listing holds the start of the playlist with nothing left out,
 * so a row's index is its position minus one.
 */
export const listsPlaylistFromStart = (items: readonly MediaItemType[]) =>
  items.every((item, index) => playlistPosition(item) === index + 1);

/**
 * The listing after moving the item at `from` to rest at `to` (0-based). The
 * positions stay with their slots, so every row keeps showing its place in
 * the playlist while the items move between them.
 */
export const moveListedItem = (
  items: MediaItemType[],
  from: number,
  to: number,
): MediaItemType[] => {
  const moved = [...items];
  moved.splice(to, 0, ...moved.splice(from, 1));
  const first = Math.min(from, to);
  const last = Math.max(from, to);
  for (let index = first; index <= last; index++) {
    const slotPosition = playlistPosition(items[index]);
    if (slotPosition !== undefined) {
      moved[index] = { ...moved[index], position: slotPosition };
    }
  }
  return moved;
};
