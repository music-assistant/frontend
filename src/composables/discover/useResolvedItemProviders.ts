// Resolves real provider(s) for ItemMappings with no provider_mappings (provider reads "library"), via getItemByUri, cached by uri per mount.
import { reactive } from "vue";
import api from "@/plugins/api";
import { getItemProviderInstanceIds } from "@/plugins/api/helpers";
import type { MediaItemTypeOrItemMapping } from "@/plugins/api/interfaces";

export function useResolvedItemProviders() {
  const resolved = reactive(new Map<string, string[]>());
  const pending = new Set<string>();

  /** Kick off resolution for any of the given items not already resolved/in flight. */
  const resolve = (items: MediaItemTypeOrItemMapping[]): void => {
    for (const item of items) {
      if (resolved.has(item.uri) || pending.has(item.uri)) continue;
      // Already a full item (has provider_mappings): resolve for free, no lookup needed.
      if (
        "provider_mappings" in item &&
        Array.isArray(item.provider_mappings) &&
        item.provider_mappings.length > 0
      ) {
        resolved.set(item.uri, getItemProviderInstanceIds(item));
        continue;
      }
      const uri = item.uri;
      pending.add(uri);
      api
        .getItemByUri(uri)
        .then((fullItem) => {
          resolved.set(uri, getItemProviderInstanceIds(fullItem));
        })
        .catch((err) => {
          console.error(
            `Failed to resolve source provider(s) for ${uri}:`,
            err,
          );
        })
        .finally(() => {
          pending.delete(uri);
        });
    }
  };

  // Resolved provider ids for an item, or undefined if still pending/unrequested.
  const providerIdsFor = (
    item: MediaItemTypeOrItemMapping,
  ): string[] | undefined => resolved.get(item.uri);

  return { resolve, providerIdsFor };
}
