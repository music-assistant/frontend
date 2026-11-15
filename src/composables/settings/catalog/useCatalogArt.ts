import { useProviderIcon } from "@/composables/useProviderIcon";
import { getCommunityIconUrl } from "@/helpers/community_catalog";
import { getIconColor, NEUTRAL_ICON_COLOR } from "@/helpers/icon_color";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

/**
 * What the drawn image of a Catalog entry is made of: its icon as a data URI,
 * for a light background whatever the theme (null while it loads or when there
 * is none), and the main colour of that icon, or a neutral one.
 *
 * @param entry - The entry drawn, if any.
 */
export function useCatalogArt(
  entry: MaybeRefOrGetter<CatalogEntry | undefined>,
) {
  const { iconDataUri } = useProviderIcon(
    () => toValue(entry)?.manifest.domain,
    { light: true },
  );

  const iconSrc = computed(
    () =>
      getCommunityIconUrl(toValue(entry)?.community?.icon) ?? iconDataUri.value,
  );

  const color = computed(
    () => getIconColor(iconSrc.value) ?? NEUTRAL_ICON_COLOR,
  );

  return { iconSrc, color };
}
