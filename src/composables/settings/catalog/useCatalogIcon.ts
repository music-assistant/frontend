import { useProviderIcon } from "@/composables/useProviderIcon";
import { getCommunityIconUrl } from "@/helpers/community_catalog";
import { isDrawnInWhite } from "@/helpers/icon_color";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

/**
 * The icon of a Catalog entry as the Marketplace draws it: as a data URI, for a
 * light background whatever the theme (null while it loads or when there is
 * none), and whether it is drawn in white only, so it needs a dark background.
 *
 * @param domain - The domain of the entry, if any.
 * @param communityIcon - The icon the community catalog gives for it, if any.
 */
export function useCatalogIcon(
  domain: MaybeRefOrGetter<string | undefined>,
  communityIcon: MaybeRefOrGetter<string | null | undefined>,
) {
  const { iconDataUri } = useProviderIcon(domain, { light: true });

  const src = computed(
    () => getCommunityIconUrl(toValue(communityIcon)) ?? iconDataUri.value,
  );

  const onDark = computed(() => isDrawnInWhite(src.value));

  return { src, onDark };
}
