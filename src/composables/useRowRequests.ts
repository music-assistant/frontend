import { onLibrarySyncCompleted } from "@/composables/useLibrarySync";
import { api } from "@/plugins/api";
import {
  EventType,
  type EventMessage,
  type MediaItemType,
  type MediaType,
  type ProviderMapping,
} from "@/plugins/api/interfaces";
import { onScopeDispose, watch, type Ref } from "vue";

// batches the burst of events a bulk library change emits into one refetch
const LIBRARY_CHANGE_DELAY_MS = 2000;

/**
 * One request per key for the item on screen.
 *
 * `identity` is what the rows are loaded from; when it changes, the requests
 * made so far are forgotten and `onReset` runs so the page can clear its caches
 * and reload. A response that arrives after the identity changed, or after its
 * key was refetched, is dropped.
 */
export function useRowRequests<Item>(
  item: Ref<Item | undefined>,
  identity: (item: Item) => string,
  onReset: () => void,
) {
  // the requests already sent for the item currently shown, each with a token
  // that tells its response apart from one of a later request for the same key
  let requested = new Map<string, object>();

  watch(
    () => item.value && identity(item.value),
    () => {
      requested = new Map();
      onReset();
    },
  );

  /**
   * Runs `load` unless `key` was requested for this item before; `store` gets
   * the result only while the item is still shown. A failing request stores [].
   */
  async function fetchOnce<T>(
    key: string,
    load: (item: Item) => Promise<T[]>,
    store: (items: T[]) => void,
  ): Promise<void> {
    const shown = item.value;
    if (!shown || requested.has(key)) return;
    const request = {};
    requested.set(key, request);
    const requestedFor = identity(shown);
    const items = await orEmpty(load(shown));
    if (
      requested.get(key) === request &&
      item.value &&
      identity(item.value) === requestedFor
    ) {
      store(items);
    }
  }

  /**
   * Refetches rows when the library adds, updates or removes an item, or
   * finishes a provider sync.
   *
   * The requests whose key starts with one of the prefixes listed for the
   * changed media type are forgotten and `reload` runs, so the rows
   * that are shown request them again. Their current data stays on screen
   * until the new response replaces it.
   *
   * @param prefixesByType - The request key prefixes each media type affects.
   * @param reload - Requests what the shown rows need.
   */
  function refetchOnLibraryChange(
    prefixesByType: Partial<Record<MediaType, string[]>>,
    reload: () => void,
  ): void {
    const changed = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (mediaType: MediaType) => {
      const prefixes = prefixesByType[mediaType];
      if (!prefixes) return;
      prefixes.forEach((prefix) => changed.add(prefix));
      clearTimeout(timer);
      timer = setTimeout(() => {
        forget([...changed]);
        changed.clear();
        reload();
      }, LIBRARY_CHANGE_DELAY_MS);
    };
    const unsubscribers = [
      api.subscribe_multi(
        [
          EventType.MEDIA_ITEM_ADDED,
          EventType.MEDIA_ITEM_UPDATED,
          EventType.MEDIA_ITEM_DELETED,
        ],
        (evt: EventMessage) => {
          const mediaType = (evt.data as MediaItemType | null | undefined)
            ?.media_type;
          if (mediaType) onChange(mediaType);
        },
      ),
      // a provider sync suppresses the per-item events, so its completion
      // stands in for them
      ...Object.keys(prefixesByType).map((mediaType) =>
        onLibrarySyncCompleted(mediaType as MediaType, () =>
          onChange(mediaType as MediaType),
        ),
      ),
    ];
    onScopeDispose(() => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      clearTimeout(timer);
    });
  }

  function forget(prefixes: string[]) {
    for (const key of requested.keys()) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        requested.delete(key);
      }
    }
  }

  return { fetchOnce, refetchOnLibraryChange };
}

/** What a media item's rows are loaded from: the item and the providers it is mapped to. */
export function mappingsIdentity(item: {
  uri: string;
  provider_mappings: ProviderMapping[];
}): string {
  const mappings = item.provider_mappings
    .map((mapping) => `${mapping.provider_instance}:${mapping.item_id}`)
    .sort();
  return [item.uri, ...mappings].join("|");
}

/** A failing provider must not blank the page, so its row just stays empty. */
async function orEmpty<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request;
  } catch (err) {
    console.error("[useRowRequests] failed to load a row", err);
    return [];
  }
}
