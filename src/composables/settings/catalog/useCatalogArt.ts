import { useCatalogIcon } from "@/composables/settings/catalog/useCatalogIcon";
import { getIconColor, NEUTRAL_ICON_COLOR } from "@/helpers/icon_color";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

/**
 * What the drawn image of a Catalog entry is made of: its icon as a data URI,
 * for a light background whatever the theme (null while it loads or when there
 * is none), whether that icon needs a dark background, and its main colour, or
 * a neutral one.
 *
 * @param entry - The entry drawn, if any.
 */
export function useCatalogArt(
  entry: MaybeRefOrGetter<CatalogEntry | undefined>,
) {
  const { src: iconSrc, onDark } = useCatalogIcon(
    () => toValue(entry)?.manifest.domain,
    () => toValue(entry)?.community?.icon,
  );

  const color = computed(
    () => getIconColor(iconSrc.value) ?? NEUTRAL_ICON_COLOR,
  );

  return { iconSrc, onDark, color };
}
