import { api, ConnectionState } from "@/plugins/api";
import {
  type CatalogRecommendation,
  EventType,
} from "@/plugins/api/interfaces";
import {
  type MaybeRefOrGetter,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  watch,
} from "vue";

/**
 * What the server suggests the current user adds, kept in step with what is set
 * up, with the community catalog and with the connection. Empty when the server
 * does not answer.
 *
 * @param communityEnabled - Whether the community catalog is enabled, or
 *   undefined while that is not known; enabling or disabling it loads again.
 */
export function useCatalogRecommendations(
  communityEnabled: MaybeRefOrGetter<boolean | undefined>,
) {
  const recommendations = ref<CatalogRecommendation[]>([]);
  // whether the first answer, or its failure, is in
  const settled = ref(false);
  // a newer load wins over an older one that answers later
  let latest = 0;

  const load = async function () {
    const own = ++latest;
    let list: CatalogRecommendation[] = [];
    try {
      list = await api.getCatalogRecommendations();
    } catch {
      // an older server or a refusal: the page shows itself without suggestions
    }
    if (own !== latest) return;
    recommendations.value = Array.isArray(list) ? list : [];
    settled.value = true;
  };

  // only a change of a known value, so the first load of the community catalog
  // does not ask again
  watch(
    () => toValue(communityEnabled),
    (_enabled, before) => {
      if (before !== undefined) void load();
    },
  );

  // an answer lost while the connection was down, or one from before, is asked again
  watch(
    () => api.state?.value,
    (state, previous) => {
      if (state === ConnectionState.INITIALIZED && previous !== state)
        void load();
    },
  );

  const unsubscribers: (() => void)[] = [];

  onMounted(() => {
    void load();
    // something added or removed, or the community catalog changed
    for (const event of [
      EventType.PROVIDERS_UPDATED,
      EventType.COMMUNITY_CATALOG_UPDATED,
    ]) {
      unsubscribers.push(api.subscribe(event, load));
    }
  });

  onBeforeUnmount(() => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  return { recommendations, settled };
}
