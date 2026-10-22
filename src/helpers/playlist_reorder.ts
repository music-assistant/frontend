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
 * Where a block lands when dropped before the row at `dropBefore` (0-based):
 * the index of its first item once the block's own rows are lifted out.
 */
export const blockStartIndex = (
  indices: readonly number[],
  dropBefore: number,
): number => dropBefore - indices.filter((index) => index < dropBefore).length;

/**
 * The listing after moving the items at `indices` (0-based) as one block that
 * starts at `toIndex`, keeping their order. The positions stay with their
 * slots, so every row keeps showing its place in the playlist while the items
 * move between them.
 */
export const moveListedItems = (
  items: MediaItemType[],
  indices: readonly number[],
  toIndex: number,
): MediaItemType[] => {
  const chosen = new Set(indices);
  const block = items.filter((_, index) => chosen.has(index));
  const rest = items.filter((_, index) => !chosen.has(index));
  const moved = [...rest.slice(0, toIndex), ...block, ...rest.slice(toIndex)];
  return moved.map((item, index) => {
    const slotPosition = playlistPosition(items[index]);
    if (item === items[index] || slotPosition === undefined) return item;
    return { ...item, position: slotPosition };
  });
};
