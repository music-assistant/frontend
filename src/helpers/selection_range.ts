/**
 * The items from `anchor` to `target`, both included and in listing order,
 * for a shift-click that selects a range. Without the anchor in the listing
 * only the target is in range.
 */
export const selectionRange = <T>(
  items: readonly T[],
  anchor: T | undefined,
  target: T,
): T[] => {
  const from = anchor === undefined ? -1 : items.indexOf(anchor);
  const to = items.indexOf(target);
  if (from === -1 || to === -1) return [target];
  return items.slice(Math.min(from, to), Math.max(from, to) + 1);
};
