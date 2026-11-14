// The options of the community catalog in the top right menu of the Catalog page.
import type { CommunityCatalogStatus } from "@/composables/settings/catalog/useCommunityCatalog";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { CircleAlert, Power, PowerOff, RefreshCw } from "@lucide/vue";
import { markRaw } from "vue";

/** What the menu needs of the community catalog. */
export interface CommunityCatalogMenuState {
  status: CommunityCatalogStatus;
  enabled: boolean;
  saving: boolean;
  setEnabled: (value: boolean) => void;
  retry: () => void;
}

/**
 * The menu entries for the community catalog: switching it on or off, or, while
 * it is not available, saying so with a way to try again.
 *
 * @param catalog - The community catalog of an admin.
 */
export const getCommunityCatalogMenuItems = (
  catalog: CommunityCatalogMenuState,
): ContextMenuItem[] => {
  if (catalog.status === "unavailable") {
    return [
      {
        label: "settings.catalog.community.unavailable",
        icon: markRaw(CircleAlert),
        disabled: true,
      },
      {
        label: "settings.retry",
        icon: markRaw(RefreshCw),
        action: catalog.retry,
      },
    ];
  }
  const { enabled } = catalog;
  return [
    {
      label: enabled
        ? "settings.catalog.community.disable"
        : "settings.catalog.community.enable",
      icon: markRaw(enabled ? PowerOff : Power),
      disabled: catalog.saving,
      action: () => catalog.setEnabled(!enabled),
    },
  ];
};
