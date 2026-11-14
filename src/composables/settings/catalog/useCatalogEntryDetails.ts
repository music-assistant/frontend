import {
  type CatalogEntry,
  getCatalogType,
  getManageRoute,
} from "@/helpers/provider_catalog";
import {
  getProviderMaintainers,
  isCommunityProvider,
} from "@/helpers/provider_config";
import { $t } from "@/plugins/i18n";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

/**
 * What a card and the detail of a Catalog entry show about it.
 *
 * @param entry - The entry shown.
 */
export function useCatalogEntryDetails(entry: MaybeRefOrGetter<CatalogEntry>) {
  const manifest = computed(() => toValue(entry).manifest);

  const typeLabel = computed(() => {
    const type = getCatalogType(manifest.value.type);
    return type ? $t(type.itemLabel) : "";
  });

  const community = computed(() => isCommunityProvider(manifest.value));

  // the people maintaining it; none when only the team does
  const maintainers = computed(() => getProviderMaintainers(manifest.value));

  const isSetUp = computed(() => toValue(entry).instances.length > 0);

  const manageRoute = computed(() => getManageRoute(toValue(entry)));

  return { typeLabel, community, maintainers, isSetUp, manageRoute };
}
