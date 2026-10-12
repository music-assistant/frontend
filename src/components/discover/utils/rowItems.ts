// Pure orchestration helpers for the per-row recommendation items fetch in
// HomeWidgetRows.vue. Split out so the "which rows need fetching" / "which
// rows should render" logic is testable without mounting the component.

export interface RecommendationRowState {
  id: string;
  hidden: boolean;
}

/**
 * Row ids whose items should be fetched: only the currently-shown rows.
 * Hidden rows are never fetched here — including default-off rows, which are
 * hidden precisely because they're heavy. In edit mode their shell still
 * renders from catalog metadata (dimmed, toggleable); their items load on
 * demand when the user unhides them.
 */
export function rowIdsNeedingItems(rows: RecommendationRowState[]): string[] {
  return rows.filter((row) => !row.hidden).map((row) => row.id);
}

/**
 * Whether a recommendation row should render, given its resolved items.
 * `items` is `undefined` while the row's fetch hasn't resolved yet.
 * - Edit mode: every row renders (dimmed if hidden) so it stays toggleable.
 * - Normal mode: a hidden row never renders. A shown row renders while its
 *   items are loading, then disappears if they resolved to zero items --
 *   unless the row has an active provider filter, in which case it stays
 *   visible (showing an empty state) so the filter control remains
 *   reachable and the user isn't stuck with a permanently hidden row.
 */
export function isRecommendationRowVisible(
  row: RecommendationRowState,
  items: unknown[] | undefined,
  editMode: boolean,
  hasActiveFilter: boolean,
): boolean {
  if (editMode) return true;
  if (row.hidden) return false;
  if (hasActiveFilter) return true;
  return items === undefined || items.length > 0;
}
