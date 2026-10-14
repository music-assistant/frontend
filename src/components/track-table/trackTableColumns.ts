export type TrackColumn =
  | "number"
  | "title"
  | "album"
  | "year"
  | "bpm"
  | "key"
  | "favorite"
  | "duration"
  | "play"
  | "menu";

// the columns the user can switch off in the column picker
export type OptionalTrackColumn = "album" | "number" | "year" | "bpm" | "key";

export const OPTIONAL_TRACK_COLUMNS: OptionalTrackColumn[] = [
  "album",
  "number",
  "year",
  "bpm",
  "key",
];

// BPM and key are only known for analysed tracks, so they start switched off
export const DEFAULT_TRACK_COLUMNS: OptionalTrackColumn[] =
  OPTIONAL_TRACK_COLUMNS.filter(
    (column) => column !== "bpm" && column !== "key",
  );

// shared by the header and the rows; the inset lines the first column up with
// the listing's title and the menu with the toolbar's right-most button
export const TRACK_TABLE_GRID_CLASS =
  "grid items-center gap-x-4 ps-[5px] pe-px";

// px, matching the rows' h-14
export const TRACK_ROW_HEIGHT = 56;

// left to right
const COLUMN_ORDER: TrackColumn[] = [
  "number",
  "title",
  "album",
  "year",
  "bpm",
  "key",
  "favorite",
  "duration",
  "play",
  "menu",
];

// the table width (px) a column needs before it is shown; title, duration and
// the menu always are
const MIN_TABLE_WIDTH: Partial<Record<TrackColumn, number>> = {
  album: 600,
  favorite: 600,
  number: 600,
  // only shown once switched on, so they outrank year
  bpm: 1000,
  key: 1000,
  year: 1100,
};

const COLUMN_WIDTH: Record<TrackColumn, string> = {
  number: "2rem",
  title: "minmax(0,4fr)",
  album: "minmax(0,3fr)",
  year: "3rem",
  bpm: "3rem",
  key: "4rem",
  favorite: "2rem",
  duration: "3.5rem",
  play: "1.75rem",
  menu: "2.5rem",
};

/**
 * Whether the table is too narrow to show the column, whether or not the user
 * switched it on.
 */
export function isHiddenAtWidth(
  column: TrackColumn,
  tableWidth: number,
): boolean {
  return tableWidth < (MIN_TABLE_WIDTH[column] ?? 0);
}

/**
 * The columns to show, in order: the ones that are always there, plus each
 * column the user switched on once the table is wide enough for it. Touch
 * devices, which cannot hover the artwork to play, get a play column.
 */
export function visibleTrackColumns(
  enabled: readonly OptionalTrackColumn[],
  tableWidth: number,
  touch = false,
): TrackColumn[] {
  return COLUMN_ORDER.filter((column) => {
    if (column === "play") return touch;
    if (isOptional(column) && !enabled.includes(column)) return false;
    return !isHiddenAtWidth(column, tableWidth);
  });
}

/**
 * The CSS grid template that lays out these columns, shared by the header and
 * every row so they line up.
 */
export function trackTableGridTemplate(
  columns: readonly TrackColumn[],
): string {
  return columns.map((column) => COLUMN_WIDTH[column]).join(" ");
}

function isOptional(column: TrackColumn): column is OptionalTrackColumn {
  return (OPTIONAL_TRACK_COLUMNS as TrackColumn[]).includes(column);
}
