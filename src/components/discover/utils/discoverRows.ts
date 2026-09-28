import {
  readRowsConfig,
  resolveRowsConfig,
  withRowHidden,
  withRowsOrder,
  writeRowsConfig,
  type ResolvedRowsConfig,
  type RowsConfig,
} from "@/helpers/rowsConfig";
import { store } from "@/plugins/store";

// Frontend-rendered rows that are not recommendation folders from the server.
// Server rows are keyed by their folder uri (e.g. library://folder/recently_played).
export const PLAYERS_ROW_ID = "players";
export const TOP_PICKS_ROW_ID = "top_picks";
export const GENRES_ROW_ID = "genres";
export const RECENTLY_PLAYED_ROW_ID = "library://folder/recently_played";
export const IN_PROGRESS_ROW_ID = "library://folder/in_progress";

// Default position of the well-known rows; every other (server) row follows
// in the order the server returns it, with the genres grid pinned last.
export const DEFAULT_PRIORITY_ROWS = [
  PLAYERS_ROW_ID,
  TOP_PICKS_ROW_ID,
  IN_PROGRESS_ROW_ID,
  RECENTLY_PLAYED_ROW_ID,
];

// Per-user discover page customization, stored as a single preference object.
// Rows the server marks default-off (enabled_by_default=false) are passed to
// the resolver as `defaultHidden`; see RowsConfig for the hidden/shown
// semantics.
export type DiscoverRowsConfig = RowsConfig;

export type ResolvedDiscoverRowsConfig = ResolvedRowsConfig;

export const DISCOVER_ROWS_PREFERENCE_KEY = "discover.rows";

// Legacy per-key preferences, written by older frontends. Read-only fallback:
// the first edit through this module snapshots them into the new format.
const LEGACY_ROW_SETTINGS_KEY = "discoverRowSettings";
const LEGACY_ENABLED_KEYS: Array<[key: string, rowId: string]> = [
  ["discoverPlayersEnabled", PLAYERS_ROW_ID],
  ["discoverTopPicksEnabled", TOP_PICKS_ROW_ID],
  ["discoverGenresEnabled", GENRES_ROW_ID],
];

interface LegacyRowSetting {
  position: number;
  enabled: boolean;
}

/**
 * The effective discover rows configuration for the current user, resolved
 * against the currently available rows.
 *
 * `availableIds` is the default order of all rows that can be shown right now.
 * `defaultHidden` lists rows the server marks default-off; each is hidden unless
 * the user opted it in via `shown`, while a normal row is visible unless the user
 * hid it. Rows the user ordered previously but that are currently unavailable
 * (e.g. their provider is offline) are left out of the result but keep their
 * saved state.
 */
export function resolveDiscoverRowsConfig(
  availableIds: string[],
  defaultHidden: string[] = [],
): ResolvedDiscoverRowsConfig {
  return resolveRowsConfig(effectiveConfig(), availableIds, defaultHidden);
}

/** Hide or unhide a single row. */
export async function setDiscoverRowHidden(
  id: string,
  hidden: boolean,
): Promise<void> {
  await writeConfig(withRowHidden(effectiveConfig(), id, hidden));
}

/**
 * Reorder the currently available rows. The given ids are rearranged within
 * the positions they already occupy in the full saved order; rows that are
 * currently unavailable keep their exact slots.
 */
export async function setDiscoverRowsOrder(
  orderedIds: string[],
  availableIds: string[],
): Promise<void> {
  const cfg = withRowsOrder(effectiveConfig(), orderedIds, availableIds);
  if (!cfg) return;
  await writeConfig(cfg);
}

function effectiveConfig(): DiscoverRowsConfig {
  const pref = store.currentUser?.preferences?.[DISCOVER_ROWS_PREFERENCE_KEY];
  if (pref && typeof pref === "object") {
    return readRowsConfig(DISCOVER_ROWS_PREFERENCE_KEY);
  }
  return legacyConfig();
}

/** Equivalent config assembled from the legacy per-key preferences. */
function legacyConfig(): DiscoverRowsConfig {
  const prefs = store.currentUser?.preferences;
  if (!prefs) return {};
  const hidden: string[] = [];
  for (const [key, rowId] of LEGACY_ENABLED_KEYS) {
    if (prefs[key] === false) hidden.push(rowId);
  }
  const order: string[] = [];
  const rowSettings = prefs[LEGACY_ROW_SETTINGS_KEY] as
    | Record<string, LegacyRowSetting>
    | undefined;
  if (rowSettings && typeof rowSettings === "object") {
    const entries = Object.entries(rowSettings).filter(
      ([, setting]) => typeof setting?.position === "number",
    );
    entries.sort((a, b) => a[1].position - b[1].position);
    for (const [uri, setting] of entries) {
      order.push(uri);
      if (setting.enabled === false) hidden.push(uri);
    }
  }
  if (order.length > 0) {
    // The legacy layout only ordered the recommendation rows; express the
    // full layout the user actually saw so the special rows keep their
    // fixed legacy spots (players/top picks first, genres last).
    order.unshift(PLAYERS_ROW_ID, TOP_PICKS_ROW_ID);
    order.push(GENRES_ROW_ID);
  }
  return { hidden, order };
}

async function writeConfig(cfg: DiscoverRowsConfig): Promise<void> {
  await writeRowsConfig(DISCOVER_ROWS_PREFERENCE_KEY, cfg);
}
