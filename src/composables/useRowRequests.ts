import type { ProviderMapping } from "@/plugins/api/interfaces";
import { watch, type Ref } from "vue";

/**
 * One request per key for the item on screen.
 *
 * `identity` is what the rows are loaded from; when it changes, the requests
 * made so far are forgotten and `onReset` runs so the page can clear its caches
 * and reload. A response that arrives after the identity changed is dropped.
 */
export function useRowRequests<Item>(
  item: Ref<Item | undefined>,
  identity: (item: Item) => string,
  onReset: () => void,
) {
  // the requests already sent for the item currently shown
  let requested = new Set<string>();

  watch(
    () => item.value && identity(item.value),
    () => {
      requested = new Set();
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
    requested.add(key);
    const requestedFor = identity(shown);
    const items = await orEmpty(load(shown));
    if (item.value && identity(item.value) === requestedFor) store(items);
  }

  return { fetchOnce };
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
