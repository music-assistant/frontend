import {
  setUserPreference,
  setUserPreferences,
} from "@/composables/userPreferences";
import {
  readRowsConfig,
  resolveRowsConfig,
  storedRowsConfig,
  withRowHidden,
  withRowsOrder,
  writeRowsConfig,
} from "@/helpers/rowsConfig";
import { api } from "@/plugins/api";
import { providerServiceName } from "@/plugins/api/helpers";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

// "library" = in-library items, "all" = every provider at once, "auto" = the
// library while it holds items for the row, else the first provider offered;
// else a provider instance id
export type RowSource = "library" | "all" | "auto" | (string & {});

export interface RowDefinition<Id extends string> {
  id: Id;
  labelKey: string;
  // shown only to a role that manages the library, which is the admin role
  adminOnly?: boolean;
  // gets a "Source" picker in Edit rows
  supportsSource?: boolean;
  // hidden while this other row is, until the user shows or hides this one
  hiddenWith?: Id;
}

export interface RowRegistryConfig<Id extends string, Item> {
  rows: readonly RowDefinition<Id>[];
  // the user preference holding the row order and visibility, e.g. "artist.rows"
  preferenceKey: string;
  // the user preference holding the per-row sources, e.g. "artist.rowSources";
  // absent when no row has a source picker
  sourcesPreferenceKey?: string;
  // other user preferences the page keeps for its rows, e.g. per-row settings;
  // reset clears them too
  extraPreferenceKeys?: readonly string[];
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
  /** Clears every preference of the rows: order/visibility, sources and the extra ones. */
  reset(): Promise<void>;
  /** The user's saved source for a row, if any. */
  getSource(id: Id): RowSource | undefined;
  /** Saves the user's source for a row; undefined or "auto" clears it, so the row follows its default. */
  setSource(id: Id, source: RowSource | undefined): Promise<void>;
  /** The sources offered in the picker for a row of this item; [] unless the row supportsSource. */
  sources(id: Id, item: Item): RowSource[];
  /**
   * The source chosen for a row of this item: the saved one while it is still
   * among the candidates, otherwise the default. Can be "auto", which
   * resolveSource turns into the source that feeds the row.
   */
  effectiveSource(id: Id, item: Item): RowSource;
  /**
   * The source a row is fed from: the effective one, with "auto" worked out
   * from `libraryHasItems` (whether the library holds items for the row) to the
   * library when it does, else the first provider offered. Undefined while an
   * automatic row's `libraryHasItems` is unknown.
   */
  resolveSource(
    id: Id,
    item: Item,
    libraryHasItems?: boolean,
  ): RowSource | undefined;
}

/**
 * The per-user row customization of one kind of detail page (order, hidden
 * rows, per-row sources), stored in the current user's preferences.
 */
export function createRowRegistry<Id extends string, Item>(
  config: RowRegistryConfig<Id, Item>,
): RowRegistry<Id, Item> {
  const {
    rows,
    preferenceKey,
    sourcesPreferenceKey,
    extraPreferenceKeys = [],
  } = config;
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

  const effectiveSource = function (id: Id, item: Item): RowSource {
    const candidates = sourceCandidates(id, item);
    const saved = getSource(id);
    if (saved && candidates.includes(saved)) return saved;
    // a streaming service is offered once, through one of its accounts
    const sameService =
      saved && candidates.find((c) => isSameStreamingService(c, saved));
    if (sameService) return sameService;
    return defaultSource(id, item, candidates);
  };

  return {
    rows,
    preferenceKey,
    sourcesPreferenceKey,
    definition: (id) => byId[id],
    resolve(availableIds) {
      const cfg = readRowsConfig(preferenceKey);
      const followingHidden = rows
        .filter((row) => row.hiddenWith && cfg.hidden?.includes(row.hiddenWith))
        .map((row) => row.id);
      const { order, hidden } = resolveRowsConfig(
        cfg,
        availableIds,
        followingHidden,
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
      const cleared: Record<string, unknown> = {
        [preferenceKey]: storedRowsConfig({}),
      };
      if (sourcesPreferenceKey) cleared[sourcesPreferenceKey] = {};
      for (const key of extraPreferenceKeys) cleared[key] = null;
      await setUserPreferences(cleared);
    },
    getSource,
    async setSource(id, source) {
      if (!sourcesPreferenceKey) return;
      const sources = { ...savedSources() };
      if (source && source !== "auto") {
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
    effectiveSource,
    resolveSource(id, item, libraryHasItems) {
      const source = effectiveSource(id, item);
      if (source !== "auto") return source;
      if (libraryHasItems === undefined) return undefined;
      if (libraryHasItems) return "library";
      return sourceCandidates(id, item).find(isProviderSource) ?? "library";
    },
  };
}

/** A source as a picker option: its value, label and (for a provider) icon domain. */
export interface SourceOption {
  value: RowSource;
  label: string;
  // provider domain, for the icon beside a provider option
  domain?: string;
}

/** The sources offered for a row of this item, as picker options in list order. */
export function rowSourceOptions<Id extends string, Item>(
  registry: RowRegistry<Id, Item>,
  id: Id,
  item: Item,
): SourceOption[] {
  return registry.sources(id, item).map((source) => ({
    value: source,
    label: rowSourceLabel(source),
    domain: api.providers[source]?.domain,
  }));
}

/** The label of a source: the library, every provider, or one of them. */
export function rowSourceLabel(source: RowSource): string {
  if (source === "library") return $t("source_library");
  if (source === "all") return $t("source_all");
  if (source === "auto") return $t("source_auto");
  const provider = api.providers[source];
  return provider ? providerServiceName(provider) : source;
}

/**
 * A row's source as a reader-facing badge: "In your library", "All sources",
 * "Automatic" (while an automatic row is still being worked out), or
 * "On <Provider>", with the provider's domain for its icon. Undefined when the
 * source is unknown.
 */
export function rowSourceDisplay(
  source?: RowSource,
): { label: string; domain?: string } | undefined {
  if (!source) return undefined;
  if (source === "library") return { label: $t("in_library") };
  if (source === "all") return { label: $t("source_all") };
  if (source === "auto") return { label: $t("source_auto") };
  const provider = api.getProvider(source);
  return {
    label: $t("on_provider", [
      provider ? providerServiceName(provider) : source,
    ]),
    domain: provider?.domain,
  };
}

/** Whether a source is a single provider rather than the library, every provider or "auto". */
function isProviderSource(source: RowSource): boolean {
  return source !== "library" && source !== "all" && source !== "auto";
}

/** Whether two sources are accounts of the same streaming service. */
function isSameStreamingService(a: RowSource, b: RowSource): boolean {
  const provider = api.providers[a];
  return (
    !!provider?.is_streaming_provider &&
    provider.domain === api.providers[b]?.domain
  );
}
