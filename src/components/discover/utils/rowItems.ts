// Pure orchestration helpers for the per-row recommendation items fetch in
// HomeWidgetRows.vue. Split out so the "which rows need fetching" / "which
// rows should render" logic is testable without mounting the component.

export interface RecommendationRowState {
  id: string;
  hidden: boolean;
}

/**
 * Row ids whose items should be fetched right now: every recommendation row
 * in edit mode (hidden rows still render, dimmed, so they stay toggleable),
 * or only the currently-shown rows otherwise.
 */
export function rowIdsNeedingItems(
  rows: RecommendationRowState[],
  editMode: boolean,
): string[] {
  return rows.filter((row) => editMode || !row.hidden).map((row) => row.id);
}

/**
 * Whether a recommendation row should render, given its resolved items.
 * `items` is `undefined` while the row's fetch hasn't resolved yet.
 * - Edit mode: every row renders (dimmed if hidden) so it stays toggleable.
 * - Normal mode: a hidden row never renders; a shown row renders while its
 *   items are loading, then disappears if they resolved to zero items (same
 *   end state as the previous `items.length > 0` filter).
 */
export function isRecommendationRowVisible(
  row: RecommendationRowState,
  items: unknown[] | undefined,
  editMode: boolean,
): boolean {
  if (editMode) return true;
  if (row.hidden) return false;
  return items === undefined || items.length > 0;
}
