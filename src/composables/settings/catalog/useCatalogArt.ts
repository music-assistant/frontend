import { useCatalogIcon } from "@/composables/settings/catalog/useCatalogIcon";
import { getIconColor, NEUTRAL_ICON_COLOR } from "@/helpers/icon_color";
import { computed, type MaybeRefOrGetter } from "vue";

/**
 * What the drawn image of a Catalog entry is made of: its icon as a data URI,
 * for a light background whatever the theme (null while it loads or when there
 * is none), whether that icon needs a dark background, and its main colour, or
 * a neutral one.
 *
 * @param domain - The domain of the entry, if any.
 * @param communityIcon - The icon the community catalog gives for it, if any.
 */
export function useCatalogArt(
  domain: MaybeRefOrGetter<string | undefined>,
  communityIcon: MaybeRefOrGetter<string | null | undefined>,
) {
  const { src: iconSrc, onDark } = useCatalogIcon(domain, communityIcon);

  const color = computed(
    () => getIconColor(iconSrc.value) ?? NEUTRAL_ICON_COLOR,
  );

  return { iconSrc, onDark, color };
}
