import { setUserPreference } from "@/composables/userPreferences";
import { store } from "@/plugins/store";

// Frontend-rendered rows that are not recommendation folders from the server.
// Server rows are keyed by their folder uri (e.g. library://folder/recently_played).
export const PLAYERS_ROW_ID = "players";
export const TOP_PICKS_ROW_ID = "top_picks";
export const GENRES_ROW_ID = "genres";

// Default position of the well-known rows; every other (server) row follows
// in the order the server returns it, with the genres grid pinned last.
export const DEFAULT_PRIORITY_ROWS = [
  PLAYERS_ROW_ID,
  TOP_PICKS_ROW_ID,
  "library://folder/in_progress",
  "library://folder/recently_played",
];

// Per-user discover page customization, stored as a single preference object.
// Visibility is hybrid: normal rows are visible by default and can be opted out
// via `hidden`; rows the server marks default-off (enabled_by_default=false) are
// hidden by default and must be opted in via `shown`. New normal rows (e.g. from
// a freshly added provider) still show up automatically. An id is in at most one
// of `hidden`/`shown`; the resolver treats `hidden` as authoritative if both.
export interface DiscoverRowsConfig {
  hidden?: string[];
  shown?: string[];
  order?: string[];
}

export interface ResolvedDiscoverRowsConfig {
  hidden: Set<string>;
  // Display order: every currently available row id exactly once.
  order: string[];
}

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
  const cfg = effectiveConfig();
  const available = new Set(availableIds);
  const userHidden = new Set(
    (cfg.hidden ?? []).filter((id) => available.has(id)),
  );
  const userShown = new Set(
    (cfg.shown ?? []).filter((id) => available.has(id)),
  );
  const defaultHiddenSet = new Set(
    defaultHidden.filter((id) => available.has(id)),
  );
  const hidden = new Set(
    availableIds.filter(
      (id) =>
        userHidden.has(id) || (defaultHiddenSet.has(id) && !userShown.has(id)),
    ),
  );
  const order = mergeOrder(cfg.order ?? [], availableIds, false);
  return { hidden, order };
}

/** Hide or unhide a single row. */
export async function setDiscoverRowHidden(
  id: string,
  hidden: boolean,
): Promise<void> {
  const cfg = effectiveConfig();
  const hiddenSet = new Set(cfg.hidden ?? []);
  const shownSet = new Set(cfg.shown ?? []);
  if (hidden) {
    hiddenSet.add(id);
    shownSet.delete(id);
  } else {
    hiddenSet.delete(id);
    shownSet.add(id);
  }
  await writeConfig({ ...cfg, hidden: [...hiddenSet], shown: [...shownSet] });
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
  const cfg = effectiveConfig();
  const fullOrder = mergeOrder(cfg.order ?? [], availableIds, true);
  const moving = new Set(orderedIds);
  if (moving.size !== orderedIds.length) return;
  const queue = [...orderedIds];
  const nextOrder = fullOrder.map((id) =>
    moving.has(id) ? queue.shift()! : id,
  );
  // Every given id must already exist in the full order.
  if (queue.length > 0) return;
  await writeConfig({ ...cfg, order: nextOrder });
}

function effectiveConfig(): DiscoverRowsConfig {
  const pref = store.currentUser?.preferences?.[DISCOVER_ROWS_PREFERENCE_KEY];
  if (pref && typeof pref === "object") {
    const cfg = pref as DiscoverRowsConfig;
    return {
      hidden: Array.isArray(cfg.hidden) ? cfg.hidden : [],
      shown: Array.isArray(cfg.shown) ? cfg.shown : [],
      order: Array.isArray(cfg.order) ? cfg.order : [],
    };
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
  const pref: DiscoverRowsConfig = {
    hidden: cfg.hidden ?? [],
    shown: cfg.shown ?? [],
    order: cfg.order ?? [],
  };
  await setUserPreference(DISCOVER_ROWS_PREFERENCE_KEY, pref);
}

/**
 * Merge the user's saved order with the available ids: give every id the
 * user hasn't ordered yet its default position — right after its nearest
 * preceding default sibling. Saved ids that are not currently available are
 * dropped from the result unless `keepUnavailable` (used when writing, so
 * a temporarily offline provider's rows keep their slots).
 */
function mergeOrder(
  userOrder: string[],
  availableIds: string[],
  keepUnavailable: boolean,
): string[] {
  const available = new Set(availableIds);
  const order = userOrder.filter(
    (id, index) =>
      userOrder.indexOf(id) === index && (keepUnavailable || available.has(id)),
  );
  for (let i = 0; i < availableIds.length; i++) {
    const id = availableIds[i];
    if (order.includes(id)) continue;
    let insertAt = 0;
    for (let j = i - 1; j >= 0; j--) {
      const prevIndex = order.indexOf(availableIds[j]);
      if (prevIndex >= 0) {
        insertAt = prevIndex + 1;
        break;
      }
    }
    order.splice(insertAt, 0, id);
  }
  return order;
}
