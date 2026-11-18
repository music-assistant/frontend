import { useResolvingItems } from "@/composables/useResolvingItems";
import { api } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import type { MediaItemTypeOrItemMapping } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { toast } from "vue-sonner";

/**
 * Open the page of the item, in the library or on one of the user's music
 * services, that this external item is found as.
 *
 * The user stays where they are while it is looked up and when it is not
 * found. A repeated click while it is looked up does nothing, and nothing
 * opens when the user moved to another page meanwhile.
 */
export const openExternalItem = async function (
  item: MediaItemTypeOrItemMapping,
): Promise<void> {
  const { isResolving, markResolving } = useResolvingItems();
  if (isResolving(item.uri)) return;
  // every navigation, back to the same page included, makes a new route
  const startRoute = router.currentRoute.value;
  try {
    const resolved = await markResolving(
      item.uri,
      api.getItem(item.media_type, item.item_id, item.provider),
    );
    if (router.currentRoute.value !== startRoute) return;
    router.push({
      name: resolved.media_type,
      params: { itemId: resolved.item_id, provider: resolved.provider },
    });
  } catch (err) {
    // a server error is already on screen as the api's own toast
    if (!(err instanceof ApiCommandError)) toast.error($t("open_item_failed"));
  }
};
