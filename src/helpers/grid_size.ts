/**
 * Cover size for the grid views of a listing, as a step on a slider: negative
 * is smaller covers, positive larger, 0 is whatever the window width gives.
 * Each step is one column fewer (or more) than the responsive default.
 */
export const GRID_SIZE_MIN = -4;
export const GRID_SIZE_MAX = 2;
export const GRID_SIZE_DEFAULT = 0;

/** Below this cover width the cards hide their action row (`@max-[150px]` in PanelviewItem). */
export const PANEL_ACTIONS_MIN_WIDTH = 150;

export const LEGACY_COMPACT_VIEW_MODE = "panel_compact";
// listings that defaulted to the compact view
const COMPACT_BY_DEFAULT_ITEMTYPES = ["genres"];

/** Whether a grid shows its actions when none is saved; hidden for former compact views. */
export const defaultShowActions = (
  savedViewMode: string | undefined,
  itemtype: string,
  hideByDefault = false,
): boolean =>
  !(
    hideByDefault ||
    savedViewMode === LEGACY_COMPACT_VIEW_MODE ||
    (!savedViewMode && COMPACT_BY_DEFAULT_ITEMTYPES.includes(itemtype))
  );

/** The live props of the cover size slider and its action buttons toggle. */
export interface GridSizeControls {
  size: number;
  showActions: boolean;
  actionsFit: boolean;
  supportsActions: boolean;
  onChange: (size: number) => void;
  onCommit: (size: number) => void;
  onToggleActions: (show: boolean) => void;
}

// the range the `col-N` classes in the listing cover
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 12;

/** The number of columns for a grid, given the responsive default. */
export const gridColumns = (responsiveColumns: number, size: number): number =>
  Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, responsiveColumns - size));

/** A stored size as a step the slider can show, whatever was stored. */
export const normalizeGridSize = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return GRID_SIZE_DEFAULT;
  }
  return Math.min(GRID_SIZE_MAX, Math.max(GRID_SIZE_MIN, Math.round(value)));
};
