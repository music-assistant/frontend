import { setUserPreference } from "@/composables/userPreferences";
import { store } from "@/plugins/store";

// Per-user customization of a page's rows, stored as a single preference
// object. Visibility is hybrid: normal rows are visible by default and can be
// opted out via `hidden`; rows the page marks default-off are hidden by default
// and must be opted in via `shown`. New rows (e.g. from a freshly added
// provider) still show up automatically. An id is in at most one of
// `hidden`/`shown`; the resolver treats `hidden` as authoritative if both.
export interface RowsConfig {
  hidden?: string[];
  shown?: string[];
  order?: string[];
}

export interface ResolvedRowsConfig {
  hidden: Set<string>;
  // Display order: every currently available row id exactly once.
  order: string[];
}

/** Read the normalized config stored under `preferenceKey` (empty arrays when unset/invalid). */
export function readRowsConfig(preferenceKey: string): RowsConfig {
  const pref = store.currentUser?.preferences?.[preferenceKey];
  const cfg = (pref && typeof pref === "object" ? pref : {}) as RowsConfig;
  return {
    hidden: Array.isArray(cfg.hidden) ? cfg.hidden : [],
    shown: Array.isArray(cfg.shown) ? cfg.shown : [],
    order: Array.isArray(cfg.order) ? cfg.order : [],
  };
}

/** Persist the config under `preferenceKey` (all three arrays present). */
export async function writeRowsConfig(
  preferenceKey: string,
  cfg: RowsConfig,
): Promise<void> {
  const pref: RowsConfig = {
    hidden: cfg.hidden ?? [],
    shown: cfg.shown ?? [],
    order: cfg.order ?? [],
  };
  await setUserPreference(preferenceKey, pref);
}

/**
 * The given configuration resolved against the currently available rows.
 *
 * `availableIds` is the default order of all rows that can be shown right now.
 * `defaultHidden` lists rows the page marks default-off; each is hidden unless
 * the user opted it in via `shown`, while a normal row is visible unless the
 * user hid it. Rows the user ordered previously but that are currently
 * unavailable (e.g. their provider is offline) are left out of the result but
 * keep their saved state.
 */
export function resolveRowsConfig(
  cfg: RowsConfig,
  availableIds: string[],
  defaultHidden: string[] = [],
): ResolvedRowsConfig {
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

/** The config with a single row hidden or unhidden. */
export function withRowHidden(
  cfg: RowsConfig,
  id: string,
  hidden: boolean,
): RowsConfig {
  const hiddenSet = new Set(cfg.hidden ?? []);
  const shownSet = new Set(cfg.shown ?? []);
  if (hidden) {
    hiddenSet.add(id);
    shownSet.delete(id);
  } else {
    hiddenSet.delete(id);
    shownSet.add(id);
  }
  return { ...cfg, hidden: [...hiddenSet], shown: [...shownSet] };
}

/**
 * The config with the currently available rows rearranged: the given ids are
 * rearranged within the positions they already occupy in the full saved order,
 * so rows that are currently unavailable keep their exact slots.
 *
 * Returns undefined when `orderedIds` is not a valid rearrangement of the
 * available rows (duplicate or unknown ids), so nothing is persisted.
 */
export function withRowsOrder(
  cfg: RowsConfig,
  orderedIds: string[],
  availableIds: string[],
): RowsConfig | undefined {
  const fullOrder = mergeOrder(cfg.order ?? [], availableIds, true);
  const moving = new Set(orderedIds);
  if (moving.size !== orderedIds.length) return undefined;
  const queue = [...orderedIds];
  const nextOrder = fullOrder.map((id) =>
    moving.has(id) ? queue.shift()! : id,
  );
  // Every given id must already exist in the full order.
  if (queue.length > 0) return undefined;
  return { ...cfg, order: nextOrder };
}

/**
 * Merge the user's saved order with the available ids: give every id the
 * user hasn't ordered yet its default position — right after its nearest
 * preceding default sibling. Saved ids that are not currently available are
 * dropped from the result unless `keepUnavailable` (used when writing, so
 * a temporarily offline provider's rows keep their slots).
 */
export function mergeOrder(
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
