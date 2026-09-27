/**
 * Cover size for the grid views of a listing, as a step on a slider: negative
 * is smaller covers, positive larger, 0 is whatever the window width gives.
 * Each step is one column fewer (or more) than the responsive default.
 */
export const GRID_SIZE_MIN = -4;
export const GRID_SIZE_MAX = 2;
export const GRID_SIZE_DEFAULT = 0;

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
