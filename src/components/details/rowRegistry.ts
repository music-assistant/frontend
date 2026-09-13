import { setUserPreference } from "@/composables/userPreferences";
import {
  readRowsConfig,
  resolveRowsConfig,
  withRowHidden,
  withRowsOrder,
  writeRowsConfig,
} from "@/helpers/rowsConfig";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";

// "library" = in-library items, "all" = every provider at once, else a provider instance id
export type RowSource = "library" | "all" | (string & {});

export interface RowDefinition<Id extends string> {
  id: Id;
  labelKey: string;
  // shown only to a role that manages the library, which is the admin role
  adminOnly?: boolean;
  // gets a "Source" picker in Edit rows
  supportsSource?: boolean;
}

export interface RowRegistryConfig<Id extends string, Item> {
  rows: readonly RowDefinition<Id>[];
  // the user preference holding the row order and visibility, e.g. "artist.rows"
  preferenceKey: string;
  // the user preference holding the per-row sources, e.g. "artist.rowSources";
  // absent when no row has a source picker
  sourcesPreferenceKey?: string;
  // the sources a row of this item could be fed from, in the order a picker lists them;
  // [] when the item leaves no choice (default: () => [])
  sourceCandidates?: (id: Id, item: Item) => RowSource[];
  // the source feeding a row when nothing valid is saved (default: candidates[0] ?? "library")
  defaultSource?: (id: Id, item: Item, candidates: RowSource[]) => RowSource;
}

export interface RowRegistry<Id extends string, Item> {
  readonly rows: readonly RowDefinition<Id>[];
  readonly preferenceKey: string;
  readonly sourcesPreferenceKey?: string;
  definition(id: Id): RowDefinition<Id>;
  /**
   * The user's row order and hidden rows, resolved against the rows available
   * right now. Nothing is hidden by default.
   */
  resolve(availableIds: Id[]): { order: Id[]; hidden: Set<Id> };
  /** Hide or unhide a single row on every page of this kind. */
  setHidden(id: Id, hidden: boolean): Promise<void>;
  /**
   * Reorder the rows available right now. The given ids are rearranged within
   * the positions they already occupy in the full saved order, so rows that
   * don't apply to this item keep their slots.
   */
  setOrder(orderedIds: Id[], availableIds: Id[]): Promise<void>;
  /** Clears both preferences (order/visibility and sources). */
  reset(): Promise<void>;
  /** The user's saved source for a row, if any. */
  getSource(id: Id): RowSource | undefined;
  setSource(id: Id, source: RowSource | undefined): Promise<void>;
  /** The sources offered in the picker for a row of this item; [] unless the row supportsSource. */
  sources(id: Id, item: Item): RowSource[];
  /**
   * The source that actually feeds a row for this item: the saved one while it
   * is still among the candidates, otherwise the default.
   */
  effectiveSource(id: Id, item: Item): RowSource;
}

/**
 * The per-user row customization of one kind of detail page (order, hidden
 * rows, per-row sources), stored in the current user's preferences.
 */
export function createRowRegistry<Id extends string, Item>(
  config: RowRegistryConfig<Id, Item>,
): RowRegistry<Id, Item> {
  const { rows, preferenceKey, sourcesPreferenceKey } = config;
  const sourceCandidates = config.sourceCandidates ?? (() => []);
  const defaultSource =
    config.defaultSource ??
    ((_id, _item, candidates: RowSource[]) => candidates[0] ?? "library");
  const byId = Object.fromEntries(rows.map((row) => [row.id, row])) as Record<
    Id,
    RowDefinition<Id>
  >;

  /** The saved `{ [rowId]: source }` object, empty when unset or invalid. */
  const savedSources = function (): Partial<Record<Id, RowSource>> {
    if (!sourcesPreferenceKey) return {};
    const pref = store.currentUser?.preferences?.[sourcesPreferenceKey];
    if (!pref || typeof pref !== "object") return {};
    return pref as Partial<Record<Id, RowSource>>;
  };

  const getSource = function (id: Id): RowSource | undefined {
    const source = savedSources()[id];
    return typeof source === "string" ? source : undefined;
  };

  return {
    rows,
    preferenceKey,
    sourcesPreferenceKey,
    definition: (id) => byId[id],
    resolve(availableIds) {
      const { order, hidden } = resolveRowsConfig(
        readRowsConfig(preferenceKey),
        availableIds,
      );
      return { order: order as Id[], hidden: hidden as Set<Id> };
    },
    async setHidden(id, hidden) {
      await writeRowsConfig(
        preferenceKey,
        withRowHidden(readRowsConfig(preferenceKey), id, hidden),
      );
    },
    async setOrder(orderedIds, availableIds) {
      const cfg = withRowsOrder(
        readRowsConfig(preferenceKey),
        orderedIds,
        availableIds,
      );
      if (!cfg) return;
      await writeRowsConfig(preferenceKey, cfg);
    },
    async reset() {
      await writeRowsConfig(preferenceKey, {});
      if (sourcesPreferenceKey)
        await setUserPreference(sourcesPreferenceKey, {});
    },
    getSource,
    async setSource(id, source) {
      if (!sourcesPreferenceKey) return;
      const sources = { ...savedSources() };
      if (source) {
        sources[id] = source;
      } else {
        delete sources[id];
      }
      await setUserPreference(sourcesPreferenceKey, sources);
    },
    sources(id, item) {
      if (!byId[id].supportsSource) return [];
      return sourceCandidates(id, item);
    },
    effectiveSource(id, item) {
      const candidates = sourceCandidates(id, item);
      const saved = getSource(id);
      if (saved && candidates.includes(saved)) return saved;
      return defaultSource(id, item, candidates);
    },
  };
}

/** The provider behind a row's source, when a single one feeds it (undefined for "library"/"all"). */
export function rowSourceProvider(
  source?: RowSource,
): { name: string; domain: string } | undefined {
  if (!source || source === "all" || source === "library") return undefined;
  const provider = api.getProvider(source);
  return provider && { name: provider.name, domain: provider.domain };
}
