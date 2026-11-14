import {
  CATALOG_DETAIL_QUERY,
  type CatalogEntry,
} from "@/helpers/provider_catalog";
import { computed, type MaybeRefOrGetter, ref, toValue, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

/**
 * The entry whose details the Catalog shows, opened from the page or by a link
 * that names its domain in the `detail` query.
 *
 * @param entries - The Catalog entries.
 */
export function useCatalogDetail(
  entries: MaybeRefOrGetter<readonly CatalogEntry[]>,
) {
  const route = useRoute();
  const router = useRouter();

  const selectedDomain = ref<string | null>(null);
  const detailOpen = ref(false);

  // looked up again on every change, so an added instance shows in the open detail
  const selectedEntry = computed(() =>
    toValue(entries).find(
      (entry) => entry.manifest.domain === selectedDomain.value,
    ),
  );

  const openDetail = (entry: CatalogEntry) => {
    selectedDomain.value = entry.manifest.domain;
    detailOpen.value = true;
  };

  const closeDetail = () => {
    detailOpen.value = false;
  };

  // a link elsewhere opens the details of an entry; the query is dropped again,
  // so the same link opens them once more after they are closed
  watch(
    () => route.query[CATALOG_DETAIL_QUERY],
    (domain) => {
      if (typeof domain !== "string") return;
      selectedDomain.value = domain;
      detailOpen.value = true;
      const { [CATALOG_DETAIL_QUERY]: _detail, ...query } = route.query;
      void router.replace({ query });
    },
    { immediate: true },
  );

  return { selectedEntry, detailOpen, openDetail, closeDetail };
}
