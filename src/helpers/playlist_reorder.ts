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
 * The index of the row holding `uri` that is nearest to `near`, or -1 when no
 * row holds it; a playlist can hold a track more than once.
 */
export const nearestIndexOf = (
  items: readonly MediaItemType[],
  uri: string,
  near: number,
) => {
  let found = -1;
  items.forEach((item, index) => {
    if (item.uri !== uri) return;
    if (found === -1 || Math.abs(index - near) < Math.abs(found - near))
      found = index;
  });
  return found;
};

/**
 * Where a block lands when dropped before the row at `dropBefore` (0-based):
 * the index of its first item once the block's own rows are lifted out.
 */
export const blockStartIndex = (
  indices: readonly number[],
  dropBefore: number,
): number => dropBefore - indices.filter((index) => index < dropBefore).length;

/**
 * For each row of a listing of `length` rows after moving the rows at
 * `indices` (0-based) as one block that starts at `toIndex`, the row it was
 * before the move.
 */
export const movedOrder = (
  length: number,
  indices: readonly number[],
  toIndex: number,
): number[] => {
  const chosen = new Set(indices);
  const all = Array.from({ length }, (_, index) => index);
  const block = all.filter((index) => chosen.has(index));
  const rest = all.filter((index) => !chosen.has(index));
  return [...rest.slice(0, toIndex), ...block, ...rest.slice(toIndex)];
};

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
): MediaItemType[] =>
  movedOrder(items.length, indices, toIndex).map((from, index) => {
    const slotPosition = playlistPosition(items[index]);
    if (from === index || slotPosition === undefined) return items[from];
    return { ...items[from], position: slotPosition };
  });
