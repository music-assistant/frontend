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

/** The listed order from before a failed move, to match rows back to it. */
export interface UndoneMove {
  // the rows as listed before the move
  before: readonly MediaItemType[];
  // the index each row listed after the move had before it
  indexBefore: ReadonlyMap<MediaItemType, number>;
}

/**
 * Finds the row read back that stands for a row listed before, by track and
 * position. After a failed move a playlist holding a track twice can't be
 * matched that way: when the order from before the move was read back, a row
 * goes back to its old place; otherwise only a track listed once is found.
 */
export const reloadedRowLocator = (
  reloaded: readonly MediaItemType[],
  undone?: UndoneMove,
): ((row: MediaItemType) => MediaItemType | undefined) => {
  if (!undone) {
    const key = (row: MediaItemType) => `${row.uri}#${playlistPosition(row)}`;
    const rows = new Map(reloaded.map((row) => [key(row), row]));
    return (row) => rows.get(key(row));
  }
  const restored =
    undone.before.length === reloaded.length &&
    undone.before.every((row, index) => row.uri === reloaded[index].uri);
  if (restored) {
    return (row) => {
      const index = undone.indexBefore.get(row);
      return index === undefined ? undefined : reloaded[index];
    };
  }
  const counts = new Map<string, number>();
  for (const row of reloaded)
    counts.set(row.uri, (counts.get(row.uri) ?? 0) + 1);
  return (row) =>
    counts.get(row.uri) === 1
      ? reloaded.find((listed) => listed.uri === row.uri)
      : undefined;
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
